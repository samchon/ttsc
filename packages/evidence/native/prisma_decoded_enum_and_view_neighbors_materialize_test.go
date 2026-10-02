package evidence

import "testing"

/**
 * Verifies enum-neighbor and view payloads keep their native unit identities.
 *
 * The source-loader units own whether Prisma returns an enum or a view in its
 * model payload. This test starts at that decoded boundary: native unit
 * materialization must preserve the returned names and member kinds without
 * installing or launching the JavaScript bridge to reach that calculation.
 *
 * @evidence contracts/testing.md#behavioral-verification prismaModelUnits receives two literal decoded payloads and prismaUnitIndex must equal each complete authored target/symbol table. The enum-neighbor case retains Sale.id/status and Seller.id as columns; the view-neighbor case retains Sale and SaleSummary as models and SaleSummary.total as a column.
 * @evidence contracts/testing.md#independent-expectations Literal prisma: model and member addresses follow the public Prisma unit contract. No expected result comes from a loader or materializer. The view input also carries both id columns and its exact native table asserts them; these are additional native assertions, not assertions claimed to have existed in the original bridge test. Enum exclusion itself belongs to the source-loader unit because this decoded model format has no enum collection.
 * @evidence contracts/testing.md#distinguishing-cases The enum-neighbor and view-neighbor named subtests use their original Sale/Seller and Sale/SaleSummary names with distinct member lists. Complete tables detect dropped or invented native units and model/column confusion. Parser admission, enum filtering and views support remain the separate direct source-loader tests' responsibilities.
 * @evidence contracts/testing.md#execution-ownership TestPrismaDecodedEnumAndViewNeighborsMaterialize is one native Go unit entry registering exactly enum-neighbors and view-neighbors in the current test process. Each subtest owns one decoded fixture and exact table comparison; it starts no Node child, native artifact build, consumer installation or product host. The original bridge tests remain until surviving execution evidence permits their removal.
 */
func TestPrismaDecodedEnumAndViewNeighborsMaterialize(t *testing.T) {
	for _, fixture := range []struct {
		name   string
		models []prismaModel
		want   string
	}{
		{
			name: "enum-neighbors",
			models: []prismaModel{
				{Name: "Sale", Fields: []prismaField{
					{Name: "id", Symbol: "column"},
					{Name: "status", Symbol: "column"},
				}},
				{Name: "Seller", Fields: []prismaField{
					{Name: "id", Symbol: "column"},
				}},
			},
			want: "prisma:Sale=model\nprisma:Sale.id=column\nprisma:Sale.status=column\nprisma:Seller=model\nprisma:Seller.id=column",
		},
		{
			name: "view-neighbors",
			models: []prismaModel{
				{Name: "Sale", Fields: []prismaField{
					{Name: "id", Symbol: "column"},
				}},
				{Name: "SaleSummary", Fields: []prismaField{
					{Name: "id", Symbol: "column"},
					{Name: "total", Symbol: "column"},
				}},
			},
			want: "prisma:Sale=model\nprisma:Sale.id=column\nprisma:SaleSummary=model\nprisma:SaleSummary.id=column\nprisma:SaleSummary.total=column",
		},
	} {
		t.Run(fixture.name, func(t *testing.T) {
			units := []*evidenceUnit{}
			for _, model := range fixture.models {
				units = append(units, prismaModelUnits(model)...)
			}
			if got := prismaUnitIndex(units); got != fixture.want {
				t.Fatalf("native unit table:\n%s\nwant:\n%s", got, fixture.want)
			}
		})
	}
}
