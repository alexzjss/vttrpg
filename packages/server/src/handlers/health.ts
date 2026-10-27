import { CORE_VERSION } from '@vtt/core';
import { json, type Handler } from '../http';

export const health: Handler = async () => json(200, { ok: true, core: CORE_VERSION });
