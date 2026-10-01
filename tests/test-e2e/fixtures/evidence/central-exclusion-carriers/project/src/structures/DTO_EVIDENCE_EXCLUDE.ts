/**
 * Central DTO exclusions.
 *
 * @evidenceExclude docs/dto.md#contract This fixture intentionally publishes no DTO.
 * @evidenceExclude prisma:Sale.id This fixture intentionally transports no sale id.
 */
export const DTO_EVIDENCE_EXCLUDE = true;
export interface SelectedDto {
  id: string;
}
