type RepositoryPickerProps = {
    repositories: string[];
    value: string;
    onChange(value: string): void;
};
export declare function RepositoryPicker({ repositories, value, onChange }: RepositoryPickerProps): import("react").JSX.Element;
export {};
