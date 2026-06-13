# Project Graph Schema

## Purpose
Defines the minimal graph used by IPS audit to verify traceability.

## Node Fields
- `id`: stable artifact identifier.
- `type`: artifact type.
- `path`: repository-relative markdown path.

## Edge Fields
- `from`: source node id.
- `type`: relationship type.
- `to`: target node id.

## Validation
`graph/project_graph.example.yaml` must include the adoption path from vision through validation.
