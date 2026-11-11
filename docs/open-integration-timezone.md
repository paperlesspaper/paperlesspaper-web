# OpenIntegration timezone fields

Use a string property with `format: "timezone"` to display a searchable timezone
picker in the native settings form. `ui:widget: "timezone"` is also supported.

```json
{
  "name": "Local clock",
  "version": "1.0.0",
  "renderPage": "./render.html",
  "formSchema": {
    "type": "object",
    "properties": {
      "timezone": {
        "type": "string",
        "format": "timezone",
        "title": "Timezone",
        "description": "Timezone used by the clock",
        "default": "Europe/Berlin"
      }
    }
  }
}
```

The selected value is stored as an IANA timezone string in
`meta.pluginSettings.timezone` (or under the property name you choose) and passed
to the integration as a setting. Existing values take precedence over defaults.
The picker preserves the saved IANA identifier when reselecting the same group
of cities. An explicit `enum` still restricts the field to its listed options.

The integration can use this setting with `Intl.DateTimeFormat`'s `timeZone`
option. This field does not change the renderer's browser timezone: use the
existing top-level manifest `timezone` property for that, for example
`"timezone": "Europe/Berlin"`.
