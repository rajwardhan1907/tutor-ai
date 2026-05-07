import 'dotenv/config';
import { ingestJSONL } from '../src/services/ingestion';

function parseArgs(argv: string[]): {
  file: string;
  module: string;
  course: string;
  dryRun: boolean;
} {
  const args: Record<string, string> = {};
  let dryRun = false;

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--dry-run') {
      dryRun = true;
    } else if (argv[i].startsWith('--') && i + 1 < argv.length) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }

  const file = args['file'];
  const module = args['module'];
  const course = args['course'];

  if (!file || !module || !course) {
    console.error(
      'Usage: ts-node scripts/ingest.ts --file <path> --module <id> --course <name> [--dry-run]'
    );
    process.exit(1);
  }

  return { file, module, course, dryRun };
}

async function main() {
  const { file, module, course, dryRun } = parseArgs(process.argv);
  if (dryRun) process.env['INGEST_DRY_RUN'] = 'true';
  console.log(`Ingesting file="${file}" module="${module}" course="${course}"${dryRun ? ' (dry-run)' : ''}`);
  await ingestJSONL(file, module, course);
}

main().catch((err) => {
  console.error('Ingestion failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
