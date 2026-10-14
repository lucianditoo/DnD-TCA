import React from "react";
import type { MovementPreviewProjection } from "../../movementPreview";

export function MovementPreviewSummary({ preview, blockedReason }: { preview: MovementPreviewProjection; blockedReason: string | null }) {
  return <div className="movement-preview-summary" data-testid="movement-preview" data-preview-status={preview.status} role="status" aria-live="polite">
    {preview.status === "empty" && <p>Disponible: {preview.availableBudgetFeet} ft. Dibuja una ruta para previsualizarla.</p>}
    {preview.status === "legal" && <p>Ruta prevista: {preview.totalCostFeet} ft. Quedarían {preview.remainingBudgetFeet} ft.</p>}
    {preview.status === "over-budget" && <p>Ruta válida pero excede movimiento. Coste {preview.totalCostFeet} ft. Exceso {preview.excessFeet} ft. Saldo: {preview.remainingBudgetFeet} ft.</p>}
    {preview.status === "illegal" && <p>Ruta inválida: {preview.reason} Paso {preview.failedStepIndex + 1}. Coste no evaluado.</p>}
    {preview.status === "unavailable" && <p>Preview no disponible: {preview.reason}</p>}
    {(preview.status === "legal" || preview.status === "over-budget") && <>
      <p>Paridad diagonal prevista: {preview.projectedContext.normalDiagonalStepsThisTurn}.</p>
      {preview.steps.filter(step => step.spatialMode === "squeezing").map(step => <p key={step.stepIndex}>Paso {step.stepIndex + 1}: Squeezing {step.squeezingAxis}.</p>)}
      {preview.acrobaticsChecks.map(check => <p key={`${check.stepIndex}-${check.enemyId}`}>Paso {check.stepIndex + 1}, {check.enemyName}: requiere prueba de Acrobacias CD 25; el servidor puede interrumpir la ruta.</p>)}
    </>}
    {preview.isAcrobatic && <p>Tumble: el servidor resolverá los posibles AdO y pruebas CD15.</p>}
    {blockedReason && <p className="error-text" data-testid="movement-action-blocked">Acción no disponible: {blockedReason}</p>}
  </div>;
}
