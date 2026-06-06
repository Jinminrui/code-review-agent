type SessionProgressProps = {
    status: "idle" | "running" | "partial" | "finished" | "failed";
};
export declare function SessionProgress({ status }: SessionProgressProps): import("react").JSX.Element;
export {};
