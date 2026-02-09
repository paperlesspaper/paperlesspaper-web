import React from "react";
import { Checkbox, Select, SelectItem, TextInput } from "@progressiveui/react";
import { Trans } from "react-i18next";
import useEditor from "../ImageEditor/useEditor";

import type {
  OpenIntegrationJsonSchema,
  OpenIntegrationJsonSchemaProperty,
} from "./types";

function isRequired(
  schema: OpenIntegrationJsonSchema | undefined,
  key: string,
  prop: OpenIntegrationJsonSchemaProperty | undefined,
): boolean {
  if (prop?.required) return true;
  if (Array.isArray(schema?.required) && schema?.required.includes(key))
    return true;
  return false;
}

function normalizeDefault(prop: OpenIntegrationJsonSchemaProperty): any {
  if (typeof prop.default !== "undefined") return prop.default;
  if (prop.type === "array") return [];
  if (prop.type === "boolean") return false;
  return "";
}

function parseArrayString(value: string): string[] {
  if (!value) return [];
  // allow newline or comma separated
  return value
    .split(/\n|,/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function stringifyArray(value: any): string {
  if (!Array.isArray(value)) return "";
  return value.join(", ");
}

export default function OpenIntegrationSchemaForm({
  schema,
  basePath = "meta.pluginSettings",
}: {
  schema?: OpenIntegrationJsonSchema;
  basePath?: string;
}) {
  const { form }: any = useEditor();

  const properties = schema?.properties || {};
  const keys = Object.keys(properties);

  React.useEffect(() => {
    console.log("Applying defaults to schema form", basePath, form, schema);
    if (!form || !schema) return;

    // Apply defaults once (only if field is currently undefined)
    for (const key of keys) {
      const prop = properties[key];
      const path = `${basePath}.${key}`;
      const current = form.getValues?.(path);
      if (typeof current === "undefined") {
        form.setValue?.(path, normalizeDefault(prop));
      }
    }
  }, [schema, /* form,  */ basePath]);

  if (!schema || schema.type !== "object") {
    return (
      <p>
        <Trans>No schema provided.</Trans>
      </p>
    );
  }

  if (keys.length === 0) {
    return (
      <p>
        <Trans>No settings required.</Trans>
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {keys.map((key) => {
        const prop = properties[key];
        const path = `${basePath}.${key}`;
        const required = isRequired(schema, key, prop);

        const label = prop.description ? (
          <span>
            {key}
            {required ? " *" : ""}
          </span>
        ) : (
          <span>
            {key}
            {required ? " *" : ""}
          </span>
        );

        if (prop.type === "boolean") {
          const checked = Boolean(form.watch?.(path));
          return (
            <Checkbox
              key={key}
              labelText={label}
              checked={checked}
              onChange={(e) => form.setValue?.(path, e.target.checked)}
            />
          );
        }

        if (prop.type === "string" && Array.isArray(prop.enum)) {
          const value = String(form.watch?.(path) ?? "");
          return (
            <Select
              key={key}
              labelText={label}
              helperText={prop.description}
              value={value}
              onChange={(e) => form.setValue?.(path, e.target.value)}
            >
              {prop.enum.map((opt) => (
                <SelectItem key={opt} value={opt} text={opt} />
              ))}
            </Select>
          );
        }

        if (prop.type === "array" && prop.items?.type === "string") {
          const value = stringifyArray(form.watch?.(path));
          return (
            <TextInput
              key={key}
              labelText={label}
              helperText={
                prop.description || (
                  <Trans>Comma-separated list (e.g. id1, id2)</Trans>
                )
              }
              value={value}
              onChange={(e) =>
                form.setValue?.(path, parseArrayString(e.target.value))
              }
              placeholder="id1, id2"
            />
          );
        }

        if (prop.type === "number" || prop.type === "integer") {
          const value = form.watch?.(path);
          return (
            <TextInput
              key={key}
              labelText={label}
              helperText={prop.description}
              value={typeof value === "undefined" ? "" : String(value)}
              onChange={(e) => {
                const raw = e.target.value;
                if (!raw) {
                  form.setValue?.(path, undefined);
                  return;
                }
                const next =
                  prop.type === "integer" ? parseInt(raw, 10) : parseFloat(raw);
                form.setValue?.(path, Number.isNaN(next) ? undefined : next);
              }}
              placeholder={
                typeof prop.default !== "undefined"
                  ? String(prop.default)
                  : undefined
              }
            />
          );
        }

        // default: string
        return (
          <TextInput
            key={key}
            labelText={label}
            helperText={prop.description}
            value={String(form.watch?.(path) ?? "")}
            onChange={(e) => form.setValue?.(path, e.target.value)}
          />
        );
      })}
    </div>
  );
}
