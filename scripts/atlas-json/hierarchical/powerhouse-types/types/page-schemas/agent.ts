import { z } from 'zod';
import { Relation, RichTextField, Select, StringFormula, TitleField } from '../notion-data.js';
import { NotionUniqueId } from '../processed-data.js';
import { makePageSchema } from './utils.js';

export const AgentPageProperties = z.object({
  ID: NotionUniqueId,
  'No.': StringFormula,
  'Document Name': TitleField,
  'Formal Doc ID': RichTextField,
  'Doc Type': Select,
  Content: RichTextField,
  'Sub-item': Relation,
  'Parent item': Relation,
  'Agent Name': Select,
  Tenets: Relation,
  'Needed Research': Relation,
  'Active Data': Relation,
  Annotations: Relation,
  'Global Tags': Relation,
});

export const AgentsPageSchema = makePageSchema(AgentPageProperties);
