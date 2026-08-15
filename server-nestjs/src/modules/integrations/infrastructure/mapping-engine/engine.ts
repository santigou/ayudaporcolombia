import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'worker_threads';
import * as path from 'path';
import { intConfig } from '../../../../shared/infrastructure/utils/config.util';

// Motor de mapeos: evalúa una plantilla JSONata contra un input dentro de un
// worker thread desechable, con límites duros de seguridad:
//
//   - TIMEOUT (MAPPING_EVAL_TIMEOUT_MS, default 2s): si la expresión se cuelga
//     (p. ej. recursión infinita), el worker se termina a la fuerza.
//   - TAMAÑO (MAPPING_MAX_INPUT_BYTES, default 256KB) de input y resultado.
//
// JSONata además es sandboxed por diseño: sin acceso a red, disco ni process.
// Se lanza un worker por evaluación (arranque ~ms): el volumen de llamadas es
// bajo (un webhook por punto) y así cualquier fuga muere con su worker.
@Injectable()
export class MappingEngine {
  private readonly logger = new Logger(MappingEngine.name);

  constructor(private readonly config: ConfigService) {}

  async evaluate(template: unknown, input: unknown): Promise<unknown> {
    this.assertSize('input', input);
    const timeoutMs = intConfig(this.config, 'MAPPING_EVAL_TIMEOUT_MS', 2000);

    return new Promise<unknown>((resolve, reject) => {
      let worker: Worker;
      try {
        // dist/.../mapping-engine/evaluator.worker.js (compilado junto al resto).
        // Los datos viajan en workerData (disponible al arrancar el worker).
        worker = new Worker(path.join(__dirname, 'evaluator.worker.js'), {
          workerData: { template, input },
        });
      } catch (err: any) {
        reject(new Error(`no se pudo iniciar el evaluador: ${err?.message ?? err}`));
        return;
      }

      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker.terminate().catch(() => {});
        fn();
      };
      const timer = setTimeout(
        () =>
          finish(() =>
            reject(new Error(`la evaluación excedió ${timeoutMs}ms (expresión demasiado costosa)`)),
          ),
        timeoutMs,
      );

      worker.once('message', (msg: { ok: boolean; value?: unknown; error?: string }) =>
        finish(() => (msg.ok ? resolve(this.assertSize('resultado', msg.value)) : reject(new Error(msg.error!)))),
      );
      worker.once('error', (err) => finish(() => reject(err)));
    });
  }

  // Límite de tamaño serializado (JSON): evita plantillas que inflen la salida.
  private assertSize(what: string, value: unknown): unknown {
    const maxBytes = intConfig(this.config, 'MAPPING_MAX_INPUT_BYTES', 256 * 1024);
    const size = Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
    if (size > maxBytes) {
      throw new Error(`${what} del mapeo excede ${maxBytes} bytes (${size})`);
    }
    return value;
  }
}