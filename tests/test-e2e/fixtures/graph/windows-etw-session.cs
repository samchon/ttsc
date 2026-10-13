using System;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;

// Test-only Win32 ETW interop. CONTROLTRACE_ID is an opaque session identifier,
// valid until that session stops, not a retained kernel HANDLE. No documented
// stale-ID ABA guarantee or atomic GUID compare-and-stop is assumed here.
public static class TtscEtwSession
{
    [StructLayout(LayoutKind.Sequential)]
    public struct Wnode
    {
        public uint BufferSize, ProviderId;
        public ulong HistoricalContext;
        public long TimeStamp;
        public Guid Guid;
        public uint ClientContext, Flags;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct Properties
    {
        public Wnode Wnode;
        public uint BufferSize, MinimumBuffers, MaximumBuffers, MaximumFileSize;
        public uint LogFileMode, FlushTimer, EnableFlags;
        public int AgeLimit;
        public uint NumberOfBuffers, FreeBuffers, EventsLost, BuffersWritten;
        public uint LogBuffersLost, RealTimeBuffersLost;
        public IntPtr LoggerThreadId;
        public uint LogFileNameOffset, LoggerNameOffset;
    }

    public sealed class Receipt
    {
        public string api, id, guid, file;
        public uint code;
        public string metadataFailure;
    }

    public sealed class Retirement
    {
        public string state, reason;
        public Receipt query, stop;
        public uint? code;
    }

    [DllImport("sechost.dll", CharSet = CharSet.Unicode, ExactSpelling = true)]
    private static extern uint StartTraceW(out ulong id, string name, IntPtr properties);

    [DllImport("sechost.dll", CharSet = CharSet.Unicode, ExactSpelling = true)]
    private static extern uint ControlTraceW(ulong id, string name, IntPtr properties, uint control);

    [DllImport("sechost.dll", ExactSpelling = true)]
    private static extern uint EnableTraceEx2(ulong id, ref Guid provider, uint control, byte level,
        ulong anyKeyword, ulong allKeyword, uint timeout, IntPtr parameters);

    // Microsoft specifies 1024-character session/file query buffers. Larger
    // names fail explicitly rather than probing a second resource or retrying.
    private const int Characters = 1024;

    private static IntPtr Allocate(Guid guid, string file, uint megabytes)
    {
        int size = Marshal.SizeOf(typeof(Properties));
        int bytes = size + Characters * 4;
        IntPtr memory = Marshal.AllocHGlobal(bytes);
        try
        {
            Marshal.Copy(new byte[bytes], 0, memory, bytes);
            Properties properties = new Properties();
            properties.Wnode.BufferSize = (uint)bytes;
            properties.Wnode.Guid = guid;
            properties.Wnode.Flags = 0x00020000; // WNODE_FLAG_TRACED_GUID
            properties.Wnode.ClientContext = 1; // QPC clock
            // EVENT_TRACE_PROPERTIES requires session-name storage before
            // file-name storage; StartTrace fills the initially empty name.
            properties.LoggerNameOffset = (uint)size;
            properties.LogFileNameOffset = (uint)(size + Characters * 2);
            if (file != null)
            {
                if (file.Length >= Characters) throw new ArgumentException("ETW output name exceeds documented capacity");
                byte[] text = Encoding.Unicode.GetBytes(file + "\0");
                Marshal.Copy(text, 0, IntPtr.Add(memory, checked((int)properties.LogFileNameOffset)), text.Length);
                properties.LogFileMode = 2; // EVENT_TRACE_FILE_MODE_CIRCULAR
                properties.MaximumFileSize = megabytes;
            }
            Marshal.StructureToPtr(properties, memory, false);
            return memory;
        }
        catch { Marshal.FreeHGlobal(memory); throw; }
    }

    private static Receipt Read(string api, uint code, IntPtr memory)
    {
        Receipt receipt = new Receipt { api = api, code = code };
        if (code != 0) return receipt;
        try
        {
        Properties properties = (Properties)Marshal.PtrToStructure(memory, typeof(Properties));
        receipt.id = properties.Wnode.HistoricalContext.ToString(CultureInfo.InvariantCulture);
        receipt.guid = properties.Wnode.Guid.ToString("D");
        int offset = checked((int)properties.LogFileNameOffset);
        int size = Marshal.SizeOf(typeof(Properties)), bytes = size + Characters * 4;
        if (offset < size || offset > bytes - 2 || (offset & 1) != 0)
            throw new InvalidOperationException("ETW returned an invalid output-name offset");
        int length = 0, capacity = Math.Min(Characters, (bytes - offset) / 2);
        while (length < capacity && Marshal.ReadInt16(memory, offset + length * 2) != 0) length++;
        if (length == capacity) throw new InvalidOperationException("ETW output name is not terminated inside its buffer");
        receipt.file = Marshal.PtrToStringUni(IntPtr.Add(memory, offset), length);
        }
        catch (Exception error) { receipt.metadataFailure = error.Message; }
        return receipt;
    }

    public static Receipt Start(string name, string file, Guid guid, uint megabytes)
    {
        IntPtr memory = Allocate(guid, file, megabytes);
        try
        {
            ulong id;
            uint code = StartTraceW(out id, name, memory);
            // Return StartTrace's actual ID and the supplied GUID directly;
            // acquiring identity through a later name query is not admission.
            Receipt receipt = new Receipt { api = "StartTraceW", code = code,
                id = id.ToString(CultureInfo.InvariantCulture), guid = guid.ToString("D"), file = file };
            return receipt;
        }
        finally { Marshal.FreeHGlobal(memory); }
    }

    // The caller persists Start's original receipt before enabling events.
    // Timeout zero requests asynchronous configuration; success does not
    // certify completed callbacks, trace readiness or loss-free observation.
    public static uint Enable(string originalId, Guid provider, ulong keywords)
    {
        return EnableTraceEx2(UInt64.Parse(originalId, CultureInfo.InvariantCulture), ref provider,
            1, 4, keywords, 0, 0, IntPtr.Zero);
    }

    // Pure comparison operates only on the API's actual file field. Strings in
    // messages or other fields grant no authority, and case is not guessed.
    public static bool Matches(Receipt admitted, Receipt queried)
    {
        return admitted != null && queried != null && admitted.code == 0 && queried.code == 0
            && !String.IsNullOrEmpty(admitted.id) && admitted.id != "0"
            && String.Equals(admitted.id, queried.id, StringComparison.Ordinal)
            && !String.IsNullOrEmpty(admitted.guid)
            && String.Equals(admitted.guid, queried.guid, StringComparison.Ordinal)
            && !String.IsNullOrEmpty(admitted.file)
            && String.Equals(admitted.file, queried.file, StringComparison.Ordinal);
    }

    public static Retirement Stop(Receipt admitted)
    {
        if (admitted == null || admitted.code != 0 || String.IsNullOrEmpty(admitted.id) || admitted.id == "0")
            return new Retirement { state = "identity-unknown", reason = "Original native admission ID is unavailable" };
        ulong id = UInt64.Parse(admitted.id, CultureInfo.InvariantCulture);
        IntPtr memory = Allocate(Guid.Parse(admitted.guid), null, 0);
        try
        {
            Receipt query = Read("ControlTraceW_QUERY", ControlTraceW(id, null, memory, 0), memory);
            if (!Matches(admitted, query)) return new Retirement { state = "identity-unknown", query = query,
                reason = "Original native ID, GUID or exact output name did not match" };
            // This is the original supported ID, never a replacement obtained
            // from a recycled name. If the API reports invalidation, retain
            // UNKNOWN; no name fallback or stale-ID recovery is attempted.
            IntPtr stopMemory = Allocate(Guid.Parse(admitted.guid), null, 0);
            try
            {
                uint code = ControlTraceW(id, null, stopMemory, 1);
                Receipt stop;
                try { stop = Read("ControlTraceW_STOP", code, stopMemory); }
                catch (Exception error)
                {
                    // Metadata failure cannot erase the original native stop acknowledgment.
                    stop = new Receipt { api = "ControlTraceW_STOP", code = code, metadataFailure = error.Message };
                }
                return new Retirement { state = code == 0 ? "stopped" : "stop-unconfirmed", code = code, query = query, stop = stop };
            }
            finally { Marshal.FreeHGlobal(stopMemory); }
        }
        finally { Marshal.FreeHGlobal(memory); }
    }
}
