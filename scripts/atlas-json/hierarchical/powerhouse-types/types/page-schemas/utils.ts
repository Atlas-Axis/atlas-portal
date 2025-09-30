/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';
import { CommonPageData, CommonPageProperties } from './common.js';

/**
 * Create a page schema by merging common page data with custom properties
 *
 * This function takes a custom properties schema and merges it with the
 * common page data schema, returning a new schema that includes both.
 *
 */
export function makePageSchema<TProperties extends z.ZodObject<any>>(pageProperties: TProperties) {
  return z.array(
    CommonPageData.extend({
      properties: CommonPageProperties.merge(pageProperties),
    }),
  );
}

/**
 * Create a global tags schema by merging common page data with custom properties
 *
 * This function takes a custom properties schema and merges it with the
 * common page data schema, returning a new schema that includes both.
 */
export function makeGlobalTagsSchema<TProperties extends z.ZodObject<any>>(pageProperties: TProperties) {
  return z.array(
    CommonPageData.extend({
      properties: pageProperties,
    }),
  );
}

/**
 * Prettify utility type
 *
 * This type recursively expands the properties of an object,
 * making all its properties accessible as top-level properties.
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
