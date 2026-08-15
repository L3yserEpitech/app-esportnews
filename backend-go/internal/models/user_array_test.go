package models

import "testing"

// Value doit produire un littéral PostgreSQL {1,2,3}. json.Marshal rendait
// [1,2,3], que Postgres rejette sur une colonne int[] — toute écriture de
// favoris partait en 500.
func TestInt64ArrayValue_PostgresLiteral(t *testing.T) {
	cases := []struct {
		in   Int64Array
		want string
	}{
		{Int64Array{270457}, "{270457}"},
		{Int64Array{1, 2, 3}, "{1,2,3}"},
		{Int64Array{}, "{}"},
		{nil, "{}"},
	}
	for _, c := range cases {
		got, err := c.in.Value()
		if err != nil {
			t.Fatalf("Value(%v) error: %v", c.in, err)
		}
		if got != c.want {
			t.Errorf("Value(%v) = %q, want %q", c.in, got, c.want)
		}
	}
}

// Ce que Value écrit doit se relire par Scan, sinon on casse le tour complet.
func TestInt64ArrayRoundTrip(t *testing.T) {
	in := Int64Array{348920, 270457}
	v, err := in.Value()
	if err != nil {
		t.Fatal(err)
	}
	var out Int64Array
	if err := out.Scan(v.(string)); err != nil {
		t.Fatalf("Scan(%v) error: %v", v, err)
	}
	if len(out) != len(in) {
		t.Fatalf("round-trip = %v, want %v", out, in)
	}
	for i := range in {
		if out[i] != in[i] {
			t.Fatalf("round-trip = %v, want %v", out, in)
		}
	}
}
