# Rivet attribution and local modifications

Portions of Clio's M1 chat foundation are adapted from
[StefanosCodes/Rivet](https://github.com/StefanosCodes/Rivet) commit
`cf116a9968d59f2c72b900cbc42a5f3ab5a9acf4`, licensed under Apache-2.0.

Clio changed the source organization, naming, event contracts, dependency
boundaries, and persistence approach. The corrective STE-8 repair mechanically
ported and adapted the committed React presentation layer while retaining
Clio's own state and contracts. The upstream Supabase service-role/REST gateway,
missing React state modules, CLI/brain, knowledge stack, artifact worker, and
historical evaluation results were not imported. See
`docs/provenance/rivet-foundation-import.md` for the full inventory.
