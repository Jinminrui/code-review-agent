type BranchSelectorProps = {
    label: string;
    value: string;
    branches: string[];
    onChange(value: string): void;
};
export declare function BranchSelector({ label, value, branches, onChange }: BranchSelectorProps): import("react").JSX.Element;
export {};
