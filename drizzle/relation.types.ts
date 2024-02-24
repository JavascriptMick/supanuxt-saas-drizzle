// Issue: https://github.com/drizzle-team/drizzle-orm/issues/695
// Workaround solution provided by: https://github.com/BearToCode
import type {
  BuildQueryResult,
  DBQueryConfig,
  ExtractTablesWithRelations
} from 'drizzle-orm';
import * as schema from './schema';

type Schema = typeof schema;
export type TSchema = ExtractTablesWithRelations<Schema>;

export type IncludeRelation<TableName extends keyof TSchema> = DBQueryConfig<
  'one' | 'many',
  boolean,
  TSchema,
  TSchema[TableName]
>['with'];

export type InferResultType<
  TableName extends keyof TSchema,
  With extends IncludeRelation<TableName> | undefined = undefined
> = BuildQueryResult<
  TSchema,
  TSchema[TableName],
  {
    with: With;
  }
>;
