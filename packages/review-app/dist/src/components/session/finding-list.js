import { jsx as _jsx } from "react/jsx-runtime";
import { FindingCard } from "./finding-card";
export function FindingList({ findings, selectedFindingId, onSelect }) {
    return (_jsx("section", { className: "grid gap-3", children: findings.map((finding) => (_jsx(FindingCard, { finding: finding, active: selectedFindingId === finding.id, onSelect: onSelect }, finding.id))) }));
}
