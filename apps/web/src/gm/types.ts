import type { Command, CommandResult } from '@vtt/core';

export type Send = (cmd: Command) => Promise<CommandResult>;
