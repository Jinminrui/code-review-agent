export async function collectUnitContext(input) {
    const [beforeContent, afterContent] = await Promise.all([
        input.gitClient.readFileAtRef(input.baseRef, input.unit.primaryFile).catch(() => ""),
        input.gitClient.readFileAtRef(input.targetRef, input.unit.primaryFile).catch(() => "")
    ]);
    return {
        unitId: input.unit.id,
        primaryFile: input.unit.primaryFile,
        beforeContent,
        afterContent
    };
}
