# Tag Taxonomy

## Entity Tags

| Pattern           | Example                   |
| ----------------- | ------------------------- |
| `person/{name}`   | `person/sarah-chen`       |
| `project/{name}`  | `project/security-audit`  |
| `topic/{name}`    | `topic/kubernetes`        |
| `company/{name}`  | `company/acme-corp`       |

Names are lowercase and hyphenated.

## Priority Tags

| Tag                 | Meaning                    |
| ------------------- | -------------------------- |
| `priority/urgent`   | Needs immediate attention  |
| `priority/high`     | Important, do soon         |
| `priority/normal`   | Standard priority (default)|
| `priority/low`      | When you get to it         |
| `priority/someday`  | No timeline                |

## Status Tags

| Tag                | Meaning                     |
| ------------------ | --------------------------- |
| `status/active`    | Currently in progress       |
| `status/waiting`   | Blocked or waiting on someone|
| `status/scheduled` | Has a planned date          |
| `status/done`      | Completed                   |

## Minimum Requirements

Every note needs:
- At least one entity tag
- One priority tag (default: `priority/normal`)
- Status tag recommended for Tasks
