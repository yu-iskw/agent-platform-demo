import { BigQuery } from '@google-cloud/bigquery';
import { GoogleAuth, Impersonated } from 'google-auth-library';

const BQ_METADATA_READER_SA_EMAIL = process.env.BQ_METADATA_READER_SA_EMAIL;
const BQ_READONLY_SCOPE = 'https://www.googleapis.com/auth/bigquery.readonly';

export type ListDatasetsStatus =
  | 'ok'
  | 'empty'
  | 'permission_denied'
  | 'project_not_found'
  | 'error';

export type ListDatasetsResult = {
  project_id: string;
  bigquery_service_account: string;
  status: ListDatasetsStatus;
  datasets: string[];
  error?: string;
};

let impersonatedAuthClientPromise: Promise<Impersonated> | undefined;

function getMetadataReaderEmail(): string {
  if (!BQ_METADATA_READER_SA_EMAIL) {
    throw new Error('BQ_METADATA_READER_SA_EMAIL is required');
  }
  return BQ_METADATA_READER_SA_EMAIL;
}

async function getImpersonatedAuthClient(): Promise<Impersonated> {
  const targetPrincipal = getMetadataReaderEmail();

  impersonatedAuthClientPromise ??= (async () => {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const sourceClient = await auth.getClient();

    return new Impersonated({
      sourceClient,
      targetPrincipal,
      lifetime: 300,
      delegates: [],
      targetScopes: [BQ_READONLY_SCOPE],
    });
  })();

  return impersonatedAuthClientPromise;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }
  return String(error);
}

function errorCode(error: unknown): number | undefined {
  if (isRecord(error) && typeof error.code === 'number') {
    return error.code;
  }
  return undefined;
}

export function mapBigQueryListError(error: unknown): {
  status: ListDatasetsStatus;
  error: string;
} {
  const message = errorMessage(error);
  const code = errorCode(error);

  if (code === 403 || /access denied/i.test(message)) {
    return { status: 'permission_denied', error: message };
  }

  if (code === 404 || /not found/i.test(message)) {
    return { status: 'project_not_found', error: message };
  }

  return { status: 'error', error: message };
}

export async function listDatasetsForCurrentUser(projectId: string): Promise<ListDatasetsResult> {
  const bigqueryServiceAccount = getMetadataReaderEmail();
  const base: Omit<ListDatasetsResult, 'status' | 'datasets' | 'error'> = {
    project_id: projectId,
    bigquery_service_account: bigqueryServiceAccount,
  };

  try {
    const authClient = await getImpersonatedAuthClient();
    const bigquery = new BigQuery({ projectId, authClient });
    const [datasets] = await bigquery.getDatasets({ projectId });
    const ids = datasets.map((dataset) => dataset.id).filter((id): id is string => Boolean(id));

    return {
      ...base,
      status: ids.length > 0 ? 'ok' : 'empty',
      datasets: ids,
    };
  } catch (error) {
    const mapped = mapBigQueryListError(error);
    return {
      ...base,
      status: mapped.status,
      datasets: [],
      error: mapped.error,
    };
  }
}
