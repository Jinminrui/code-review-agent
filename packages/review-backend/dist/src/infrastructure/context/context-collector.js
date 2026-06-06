export async function collectUnitContext(input) {
    return {
        unitId: input.unit.id,
        primaryFile: input.unit.primaryFile,
        beforeContent: `base:${input.baseRef}`,
        afterContent: `target:${input.targetRef}`
    };
}
