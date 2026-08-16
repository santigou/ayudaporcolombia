import { parentPort, workerData } from 'worker_threads';
import { evaluateTemplate } from './template-evaluator';

// Worker de un solo uso: evalúa una plantilla contra un input y responde.
// Aislado del hilo principal para que una expresión pesada o colgada no bloquee
// al servidor (el engine lo termina con timeout).
(async () => {
  try {
    const value = await evaluateTemplate(workerData.template, workerData.input);
    parentPort!.postMessage({ ok: true, value });
  } catch (err: any) {
    parentPort!.postMessage({ ok: false, error: err?.message ?? String(err) });
  }
})();