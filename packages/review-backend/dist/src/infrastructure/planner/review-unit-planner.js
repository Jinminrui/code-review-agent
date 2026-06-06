export function buildReviewUnits(files) {
    return files.map((file, index) => ({
        id: `unit_${index + 1}`,
        primaryFile: file.path,
        files: [file.path],
        diffPaths: [file.path]
    }));
}
