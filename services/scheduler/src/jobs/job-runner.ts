// ─── Job Runner ──────────────────────────────────────────────────────────────
// Think of this like a simple alarm clock manager: each job is an alarm that
// rings at a fixed interval. The runner keeps track of which alarms are set,
// when they last rang, and whether they're currently ringing.

export interface JobDefinition {
  name: string;
  description: string;
  intervalMs: number;
  handler: () => Promise<void>;
}

export type JobStatus = 'idle' | 'running' | 'error';

export interface JobState {
  name: string;
  description: string;
  intervalMs: number;
  status: JobStatus;
  lastRunAt: string | null;
  lastError: string | null;
  runCount: number;
  errorCount: number;
}

interface InternalJobEntry {
  definition: JobDefinition;
  timerId: ReturnType<typeof setInterval> | null;
  status: JobStatus;
  lastRunAt: Date | null;
  lastError: string | null;
  runCount: number;
  errorCount: number;
}

export class JobRunner {
  private readonly jobs = new Map<string, InternalJobEntry>();
  private running = false;

  register(definition: JobDefinition): void {
    if (this.jobs.has(definition.name)) {
      throw new Error(`Job "${definition.name}" is already registered`);
    }

    this.jobs.set(definition.name, {
      definition,
      timerId: null,
      status: 'idle',
      lastRunAt: null,
      lastError: null,
      runCount: 0,
      errorCount: 0,
    });

    console.log(`[scheduler] Registered job: ${definition.name} (every ${definition.intervalMs}ms)`);
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;

    for (const [name, entry] of this.jobs) {
      const timerId = setInterval(() => {
        void this.executeJob(name);
      }, entry.definition.intervalMs);

      entry.timerId = timerId;
      console.log(`[scheduler] Started job: ${name}`);
    }

    console.log(`[scheduler] All ${this.jobs.size} jobs started`);
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    for (const [name, entry] of this.jobs) {
      if (entry.timerId !== null) {
        clearInterval(entry.timerId);
        entry.timerId = null;
      }
      console.log(`[scheduler] Stopped job: ${name}`);
    }

    this.running = false;
    console.log('[scheduler] All jobs stopped');
  }

  async triggerJob(name: string): Promise<{ success: boolean; error?: string }> {
    const entry = this.jobs.get(name);
    if (!entry) {
      return { success: false, error: `Job "${name}" not found` };
    }

    if (entry.status === 'running') {
      return { success: false, error: `Job "${name}" is already running` };
    }

    await this.executeJob(name);
    const updatedEntry = this.jobs.get(name);
    if (updatedEntry?.status === 'error') {
      return { success: false, error: updatedEntry.lastError ?? 'Unknown error' };
    }

    return { success: true };
  }

  getJobStates(): JobState[] {
    const states: JobState[] = [];

    for (const entry of this.jobs.values()) {
      states.push({
        name: entry.definition.name,
        description: entry.definition.description,
        intervalMs: entry.definition.intervalMs,
        status: entry.status,
        lastRunAt: entry.lastRunAt?.toISOString() ?? null,
        lastError: entry.lastError,
        runCount: entry.runCount,
        errorCount: entry.errorCount,
      });
    }

    return states;
  }

  getJobState(name: string): JobState | null {
    const entry = this.jobs.get(name);
    if (!entry) {
      return null;
    }

    return {
      name: entry.definition.name,
      description: entry.definition.description,
      intervalMs: entry.definition.intervalMs,
      status: entry.status,
      lastRunAt: entry.lastRunAt?.toISOString() ?? null,
      lastError: entry.lastError,
      runCount: entry.runCount,
      errorCount: entry.errorCount,
    };
  }

  isRunning(): boolean {
    return this.running;
  }

  getJobNames(): string[] {
    return Array.from(this.jobs.keys());
  }

  private async executeJob(name: string): Promise<void> {
    const entry = this.jobs.get(name);
    if (!entry) {
      return;
    }

    if (entry.status === 'running') {
      console.log(`[scheduler] Skipping "${name}" — already running`);
      return;
    }

    entry.status = 'running';
    const startTime = Date.now();

    try {
      await entry.definition.handler();
      entry.status = 'idle';
      entry.lastRunAt = new Date();
      entry.runCount += 1;
      entry.lastError = null;

      const durationMs = Date.now() - startTime;
      console.log(`[scheduler] Job "${name}" completed in ${durationMs}ms`);
    } catch (error) {
      entry.status = 'error';
      entry.lastRunAt = new Date();
      entry.errorCount += 1;
      entry.lastError = error instanceof Error ? error.message : String(error);

      console.error(`[scheduler] Job "${name}" failed:`, entry.lastError);
    }
  }
}

// Singleton instance
let jobRunnerInstance: JobRunner | null = null;

export function getJobRunner(): JobRunner {
  if (!jobRunnerInstance) {
    jobRunnerInstance = new JobRunner();
  }
  return jobRunnerInstance;
}

// For testing: reset the singleton
export function resetJobRunner(): void {
  if (jobRunnerInstance) {
    jobRunnerInstance.stop();
  }
  jobRunnerInstance = null;
}
