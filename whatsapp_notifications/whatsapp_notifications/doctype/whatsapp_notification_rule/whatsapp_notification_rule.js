// WhatsApp Notification Rule - Client Script

const RECIPIENT_HINTS = {
    'Document Contact': 'Sends to the phone number stored in a field of the document (e.g. the catechumen\'s contact).',
    'Fixed Numbers':    'Always sends to a fixed list of phone numbers you enter below, regardless of the document.',
    'Document + Fixed': 'Sends to both the document\'s phone field AND your fixed list of numbers.',
    'WhatsApp Group':   'Sends to a WhatsApp group — click "Select Group" to choose one.',
    'Document + Group': 'Sends to the document\'s phone field AND the selected WhatsApp group.'
};

const EVENT_HINTS = {
    'After Insert': 'Fires once when a new record is created and saved for the first time.',
    'On Update':    'Fires every time an existing record is saved (after each edit).',
    'On Submit':    'Fires when a submittable document is submitted.',
    'On Cancel':    'Fires when a submitted document is cancelled.',
    'On Change':    'Fires only when a specific field value changes (set "Field to Watch" below).',
    'On Trash':     'Fires when a record is permanently deleted.',
    'Days Before':  'Scheduled: fires daily for documents where a date field is exactly N days away in the future.',
    'Days After':   'Scheduled: fires daily for documents where a date field was exactly N days ago in the past.'
};

const DATE_FIELD_TYPES = ['Date', 'Datetime'];

frappe.ui.form.on('WhatsApp Notification Rule', {
    refresh: function (frm) {
        // Status indicator badge
        frm.page.set_indicator(
            frm.doc.enabled ? __('Active') : __('Inactive'),
            frm.doc.enabled ? 'green' : 'red'
        );

        // Action buttons
        if (!frm.is_new() && frm.doc.document_type) {
            frm.add_custom_button(__('Preview Message'), function () {
                show_preview_dialog(frm);
            }, __('Actions'));

            frm.add_custom_button(__('Test Send'), function () {
                show_test_dialog(frm);
            }, __('Actions'));

            frm.add_custom_button(__('View Logs'), function () {
                frappe.set_route('List', 'WhatsApp Message Log', {
                    notification_rule: frm.doc.name
                });
            }, __('Actions'));
        }

        setup_template_help(frm);
        show_recipient_hint(frm);
        show_row_condition_hint(frm);
        update_phone_field_required(frm);

        if (frm.doc.document_type) {
            load_all_field_options(frm);
            if (frm.doc.use_child_table) {
                load_child_table_options(frm);
                if (frm.doc.child_table) {
                    setup_child_phone_field_ui(frm);
                    setup_watch_fields_ui(frm);
                }
            }
        }
    },

    enabled: function (frm) {
        frm.page.set_indicator(
            frm.doc.enabled ? __('Active') : __('Inactive'),
            frm.doc.enabled ? 'green' : 'red'
        );
    },

    document_type: function (frm) {
        frm.set_value('phone_field', '');
        frm.set_value('value_changed', '');
        frm.set_value('date_field', '');
        frm.set_value('child_table', '');
        frm.set_value('child_phone_field', '');

        if (frm.doc.document_type) {
            load_all_field_options(frm);
            if (frm.doc.use_child_table) {
                load_child_table_options(frm);
            }
        }
    },

    event: function (frm) {
        // Required toggle for value_changed
        frm.toggle_reqd('value_changed', frm.doc.event === 'On Change');

        let hint = EVENT_HINTS[frm.doc.event];
        if (hint) {
            frappe.show_alert({ message: __(hint), indicator: 'blue' }, 6);
        }

        // Load date fields when switching to Days Before/After
        if (['Days Before', 'Days After'].includes(frm.doc.event) && frm.doc.document_type) {
            load_date_field_options(frm);
        }
    },

    recipient_type: function (frm) {
        let needs_group = ['WhatsApp Group', 'Document + Group'].includes(frm.doc.recipient_type);
        let needs_fixed = ['Fixed Numbers', 'Document + Fixed'].includes(frm.doc.recipient_type);

        frm.toggle_reqd('fixed_recipients', needs_fixed);

        if (!needs_group) {
            frm.set_value('group_id', '');
            frm.set_value('group_name', '');
        }

        update_phone_field_required(frm);
        show_recipient_hint(frm);
    },

    select_group_button: function (frm) {
        show_group_selection_dialog(frm);
    },

    use_child_table: function (frm) {
        update_phone_field_required(frm);
        show_row_condition_hint(frm);

        if (frm.doc.use_child_table && frm.doc.document_type) {
            load_child_table_options(frm);
        } else {
            frm.set_value('child_table', '');
            frm.set_value('child_phone_field', '');
            frm.set_value('child_watch_fields', '');
        }
        setup_template_help(frm);
        setup_watch_fields_ui(frm);
    },

    child_table: function (frm) {
        frm.set_value('child_phone_field', '');
        frm.set_value('child_watch_fields', '');
        setup_child_phone_field_ui(frm);
        setup_watch_fields_ui(frm);
    },

    only_changed_rows: function (frm) {
        setup_watch_fields_ui(frm);
    },

    child_watch_fields: function (frm) {
        // Re-render chips to reflect manual edits to the text field
        _refresh_watch_chips(frm);
    },

    phone_field: function (frm) {
        _refresh_multifield_ui(frm, 'phone_field');
    },

    child_phone_field: function (frm) {
        _refresh_multifield_ui(frm, 'child_phone_field');
    }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function show_row_condition_hint(frm) {
    let field = frm.fields_dict.row_condition;
    if (!field) return;

    let $wrapper = field.$wrapper;
    $wrapper.find('.row-cond-hint').remove();

    if (!frm.doc.use_child_table) return;

    $wrapper.append(`
        <p class="row-cond-hint help-box small text-muted" style="margin-top:4px;">
            <strong>${__('Tip')}:</strong>
            ${__('Use')} <code>or</code> / <code>and</code> ${__('inside one')} <code>{{ }}</code> ${__('block:')}
            <code>{{ row.valor_a != 0 or row.valor_b != 0 }}</code>.
            ${__('Multi-block')} <code>{{ }} || {{ }}</code> ${__('also works — see Template Help above.')}
        </p>
    `);
}

/**
 * Replaces the child_watch_fields raw input with:
 *  - A dropdown to pick fields to watch (only un-selected fields shown)
 *  - Green chips for each selected field, with × to remove
 *  - "Watching all fields" hint when nothing is selected
 */
function setup_watch_fields_ui(frm) {
    let field = frm.fields_dict.child_watch_fields;
    if (!field) return;

    let $wrapper = field.$wrapper;

    // Remove previous custom UI and restore the raw input
    $wrapper.find('.watch-fields-ui').remove();
    $wrapper.find('.control-input-wrapper').show();

    // Only show when all prerequisites are met
    if (!frm.doc.use_child_table || !frm.doc.only_changed_rows || !frm.doc.child_table || !frm.doc.document_type) {
        return;
    }

    // Hide the raw text input — replaced by chips + select picker below
    $wrapper.find('.control-input-wrapper').hide();

    frappe.call({
        method: 'whatsapp_notifications.whatsapp_notifications.doctype.whatsapp_notification_rule.whatsapp_notification_rule.get_child_table_fields',
        args: {
            doctype: frm.doc.document_type,
            child_table_field: frm.doc.child_table,
            all_fields: 1
        },
        callback: function (r) {
            if (!r.message || !r.message.length) return;

            frm._watch_field_options = r.message;

            let $ui = $(`
                <div class="watch-fields-ui" style="margin-top:4px;">
                    <div class="watch-chips" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;min-height:22px;"></div>
                    <select class="watch-add-select form-control input-xs" style="width:auto;max-width:320px;display:inline-block;">
                        <option value="">${__('+ Add field to watch...')}</option>
                    </select>
                </div>
            `);

            $wrapper.append($ui);

            // Populate dropdown — will be filtered by _render_watch_chips
            frm._watch_field_options.forEach(f => {
                $ui.find('.watch-add-select').append(
                    $('<option>').val(f.fieldname).text(`${f.label || f.fieldname} (${f.fieldname})`)
                );
            });

            // Adding a field from the dropdown
            $ui.find('.watch-add-select').on('change', function () {
                let fn = $(this).val();
                if (!fn) return;

                let current = (frm.doc.child_watch_fields || '')
                    .split(',').map(s => s.trim()).filter(Boolean);

                if (!current.includes(fn)) {
                    current.push(fn);
                    frm.set_value('child_watch_fields', current.join(', '));
                }
                $(this).val('');
            });

            _render_watch_chips(frm, r.message);
        }
    });
}

/** Rebuild chips and dropdown options after the value changes. */
function _refresh_watch_chips(frm) {
    if (!frm._watch_field_options) return;
    _render_watch_chips(frm, frm._watch_field_options);
}

function _render_watch_chips(frm, fields) {
    let field = frm.fields_dict.child_watch_fields;
    if (!field) return;

    let $wrapper = field.$wrapper;
    let $chips = $wrapper.find('.watch-chips');
    let $select = $wrapper.find('.watch-add-select');
    if (!$chips.length) return;

    let current = (frm.doc.child_watch_fields || '')
        .split(',').map(f => f.trim()).filter(Boolean);
    let selected = new Set(current);

    let labelMap = {};
    fields.forEach(f => { labelMap[f.fieldname] = f.label || f.fieldname; });

    // Update chips
    $chips.empty();

    if (!current.length) {
        $chips.append(
            `<span class="text-muted small" style="line-height:22px;">${__('None selected — all fields are watched')}</span>`
        );
    } else {
        current.forEach(fn => {
            let label = labelMap[fn] || fn;
            let $chip = $(`
                <span class="watch-chip" style="
                    display:inline-flex;align-items:center;gap:5px;
                    padding:3px 8px 3px 12px;border-radius:14px;
                    background:#25D366;color:#fff;border:1px solid #1da050;
                    font-size:12px;user-select:none;">
                    <span>${frappe.utils.escape_html(label)}</span>
                    <span style="font-size:10px;opacity:.8;">(${frappe.utils.escape_html(fn)})</span>
                    <span class="remove-chip" data-fieldname="${frappe.utils.escape_html(fn)}"
                          title="${__('Remove')}"
                          style="cursor:pointer;font-size:16px;line-height:1;margin-left:2px;opacity:.85;">×</span>
                </span>
            `);

            $chip.find('.remove-chip').on('click', function () {
                let fn = $(this).data('fieldname');
                let vals = (frm.doc.child_watch_fields || '')
                    .split(',').map(s => s.trim()).filter(s => s && s !== fn);
                frm.set_value('child_watch_fields', vals.join(', '));
            });

            $chips.append($chip);
        });
    }

    // Update dropdown: hide already-selected options
    if ($select.length) {
        $select.find('option[value!=""]').each(function () {
            $(this).toggle(!selected.has($(this).val()));
        });
    }
}

// ─── Multi-field Chip Picker (phone_field / child_phone_field) ───────────────

/**
 * Replace a Data field's raw input with a dropdown+chips picker.
 * The underlying field stores a comma-separated list of fieldnames.
 *
 * @param {object} frm            - Form object
 * @param {string} field_name     - Frappe field name ('phone_field' or 'child_phone_field')
 * @param {Array}  available_fields - [{fieldname, label}]
 */
function _setup_multifield_ui(frm, field_name, available_fields) {
    let field = frm.fields_dict[field_name];
    if (!field) return;

    let $wrapper = field.$wrapper;
    let ui_class = 'mf-ui-' + field_name.replace(/_/g, '-');

    // Remove any previous chip UI, restore raw input
    $wrapper.find('.' + ui_class).remove();
    $wrapper.find('.control-input-wrapper').show();

    if (!available_fields || !available_fields.length) return;

    // Hide the raw text input — replaced by chip+select below
    $wrapper.find('.control-input-wrapper').hide();

    // Cache available fields for refresh
    frm['_mf_options_' + field_name] = available_fields;

    let $ui = $(`
        <div class="${ui_class}" style="margin-top:4px;">
            <div class="${ui_class}-chips" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;min-height:22px;"></div>
            <select class="${ui_class}-select form-control input-xs" style="width:auto;max-width:320px;display:inline-block;">
                <option value="">${__('+ Add field...')}</option>
            </select>
        </div>
    `);

    $wrapper.append($ui);

    // Populate dropdown
    available_fields.forEach(f => {
        $ui.find('.' + ui_class + '-select').append(
            $('<option>').val(f.fieldname).text(f.label || f.fieldname)
        );
    });

    // Add field on select
    $ui.find('.' + ui_class + '-select').on('change', function () {
        let fn = $(this).val();
        if (!fn) return;
        let current = (frm.doc[field_name] || '')
            .split(',').map(s => s.trim()).filter(Boolean);
        if (!current.includes(fn)) {
            current.push(fn);
            frm.set_value(field_name, current.join(', '));
        }
        $(this).val('');
    });

    _render_multifield_chips(frm, field_name, available_fields);
}

/** Re-render chips when the field value changes externally. */
function _refresh_multifield_ui(frm, field_name) {
    let available = frm['_mf_options_' + field_name];
    if (!available) return;
    _render_multifield_chips(frm, field_name, available);
}

function _render_multifield_chips(frm, field_name, fields) {
    let field = frm.fields_dict[field_name];
    if (!field) return;

    let $wrapper = field.$wrapper;
    let ui_class = 'mf-ui-' + field_name.replace(/_/g, '-');
    let $chips = $wrapper.find('.' + ui_class + '-chips');
    let $select = $wrapper.find('.' + ui_class + '-select');
    if (!$chips.length) return;

    let current = (frm.doc[field_name] || '')
        .split(',').map(f => f.trim()).filter(Boolean);
    let selected = new Set(current);

    let labelMap = {};
    fields.forEach(f => { labelMap[f.fieldname] = f.label || f.fieldname; });

    $chips.empty();

    if (!current.length) {
        $chips.append(
            `<span class="text-muted small" style="line-height:22px;">${__('No field selected')}</span>`
        );
    } else {
        current.forEach(fn => {
            let label = labelMap[fn] || fn;
            let $chip = $(`
                <span style="
                    display:inline-flex;align-items:center;gap:5px;
                    padding:3px 8px 3px 12px;border-radius:14px;
                    background:#2196F3;color:#fff;border:1px solid #1565C0;
                    font-size:12px;user-select:none;">
                    <span>${frappe.utils.escape_html(label)}</span>
                    <span class="remove-mf-chip" data-fieldname="${frappe.utils.escape_html(fn)}"
                          title="${__('Remove')}"
                          style="cursor:pointer;font-size:16px;line-height:1;margin-left:2px;opacity:.85;">×</span>
                </span>
            `);
            $chip.find('.remove-mf-chip').on('click', function () {
                let fn = $(this).data('fieldname');
                let vals = (frm.doc[field_name] || '')
                    .split(',').map(s => s.trim()).filter(s => s && s !== fn);
                frm.set_value(field_name, vals.join(', '));
            });
            $chips.append($chip);
        });
    }

    // Hide already-selected options in the dropdown
    if ($select.length) {
        $select.find('option[value!=""]').each(function () {
            $(this).toggle(!selected.has($(this).val()));
        });
    }
}

function update_phone_field_required(frm) {
    let needs_phone = ['Document Contact', 'Document + Fixed', 'Document + Group'].includes(frm.doc.recipient_type);
    // phone_field is only relevant (and required) when NOT using child table
    frm.toggle_reqd('phone_field', needs_phone && !frm.doc.use_child_table);
}

function show_recipient_hint(frm) {
    let $wrapper = frm.fields_dict.recipient_type && frm.fields_dict.recipient_type.$wrapper;
    if (!$wrapper) return;

    $wrapper.find('.recipient-hint').remove();

    let hint = RECIPIENT_HINTS[frm.doc.recipient_type];
    if (hint) {
        $wrapper.append(
            `<p class="recipient-hint help-box small text-muted" style="margin-top:4px;">${__(hint)}</p>`
        );
    }
}

/**
 * Load all dynamic field options in a single API call.
 * Splits results into phone, all-fields, and date options for the three selectors.
 */
function load_all_field_options(frm) {
    if (!frm.doc.document_type) return;

    frappe.call({
        method: 'whatsapp_notifications.whatsapp_notifications.api.get_doctype_fields',
        args: { doctype: frm.doc.document_type },
        callback: function (r) {
            if (!r.message || !r.message.success) return;

            let all_fields = r.message.fields;

            // All fields for value_changed (watch any field)
            let all_options = all_fields
                .map(f => ({ label: `${f.label} — ${f.fieldtype} (${f.fieldname})`, value: f.fieldname }));
            all_options.unshift({ label: '', value: '' });

            // Date/Datetime fields for date_field
            let date_options = all_fields
                .filter(f => DATE_FIELD_TYPES.includes(f.fieldtype))
                .map(f => ({ label: `${f.label} (${f.fieldname})`, value: f.fieldname }));
            date_options.unshift({ label: '', value: '' });

            set_field_options(frm, 'value_changed', all_options);
            set_field_options(frm, 'date_field', date_options);

            // phone_field: chip+dropdown picker with all available fields
            let phone_picker_fields = all_fields.map(f => ({
                fieldname: f.fieldname,
                label: `${f.label || f.fieldname} (${f.fieldtype})`
            }));
            _setup_multifield_ui(frm, 'phone_field', phone_picker_fields);
        }
    });
}

function load_date_field_options(frm) {
    // Piggybacks on load_all_field_options — just re-runs it to ensure date_field is populated
    load_all_field_options(frm);
}

function set_field_options(frm, fieldname, options) {
    let field = frm.get_field(fieldname);
    if (!field) return;
    field.df.options = options;
    field.refresh();
}

function load_child_table_options(frm) {
    if (!frm.doc.document_type) return;

    frappe.call({
        method: 'whatsapp_notifications.whatsapp_notifications.doctype.whatsapp_notification_rule.whatsapp_notification_rule.get_child_tables',
        args: { doctype: frm.doc.document_type },
        callback: function (r) {
            if (!r.message) return;
            let options = [''].concat(r.message.map(t => t.fieldname));
            let field = frm.get_field('child_table');
            if (field) {
                field.df.options = options.join('\n');
                field.refresh();
            }
        }
    });
}

function setup_child_phone_field_ui(frm) {
    // Always teardown first (handles case where child_table is cleared)
    let field = frm.fields_dict['child_phone_field'];
    if (field) {
        field.$wrapper.find('.mf-ui-child-phone-field').remove();
        field.$wrapper.find('.control-input-wrapper').show();
    }

    if (!frm.doc.document_type || !frm.doc.child_table) return;

    frappe.call({
        method: 'whatsapp_notifications.whatsapp_notifications.doctype.whatsapp_notification_rule.whatsapp_notification_rule.get_child_table_fields',
        args: {
            doctype: frm.doc.document_type,
            child_table_field: frm.doc.child_table
        },
        callback: function (r) {
            if (!r.message) return;
            let picker_fields = r.message.map(f => ({
                fieldname: f.fieldname,
                label: `${f.label || f.fieldname} (${f.fieldname})`
            }));
            _setup_multifield_ui(frm, 'child_phone_field', picker_fields);
        }
    });
}

// ─── Template Help ──────────────────────────────────────────────────────────

function setup_template_help(frm) {
    if (!frm.doc.document_type) return;

    let $msg_wrapper = frm.fields_dict.message_template && frm.fields_dict.message_template.$wrapper;
    if (!$msg_wrapper) return;

    $msg_wrapper.siblings('.template-help-toggle, .template-help-panel').remove();

    let child_section = '';
    if (frm.doc.use_child_table) {
        child_section = `
            <div style="margin-bottom:12px;">
                <strong>${__('Child Table Row Variables')}</strong>
                <pre style="background:#f4f5f6;padding:8px;border-radius:4px;margin-top:4px;">{{ row.fieldname }}
{{ row.idx }}
{{ row.nome }}
{{ row.contacto }}</pre>
            </div>
            <div style="margin-bottom:12px;">
                <strong>${__('What Changed This Save')}</strong>
                <p class="text-muted small" style="margin:4px 0;">${__('These variables are always available in child-table templates and let you react to exactly which field changed:')}</p>
                <pre style="background:#f4f5f6;padding:8px;border-radius:4px;">{{/* List of field names that changed */}}
{% if changed_fields %}Campos alterados: {{ changed_fields | join(", ") }}{% endif %}

{{/* New value of each changed field */}}
{% if "valor_fotos" in changed_fields %}
Recebemos o pagamento de *fotos*: {{ changed_values.valor_fotos }}
{% endif %}
{% if "valor_cracha" in changed_fields %}
Recebemos o pagamento de *crachá*: {{ changed_values.valor_cracha }}
{% endif %}

{{/* Old value (before save) of a changed field */}}
{% if "valor_ofertorio" in changed_fields %}
Anterior: {{ previous_values.valor_ofertorio }}  →  Actual: {{ row.valor_ofertorio }}
{% endif %}

{{/* Full previous row state (or None for new rows) */}}
{% if row_before %}Oferta anterior: {{ row_before.valor_ofertorio }}{% endif %}</pre>
                <p class="text-muted small" style="margin:4px 0;">${__('Tip: for new rows')} <code>row_before</code> ${__('is')} <code>None</code> ${__('and')} <code>changed_fields</code> ${__('is empty')} <code>[]</code>. ${__('Use')} <code>{% if row_before %}</code> ${__('to guard against that.')}</p>
            </div>
            <div style="margin-bottom:12px;">
                <strong>${__('Row Condition — correct syntax')}</strong>
                <p class="text-muted small" style="margin:4px 0;">${__('Use a single Jinja2 expression per {{ }} block. To combine multiple checks use <code>or</code> / <code>and</code> inside one block, or separate blocks with <code>||</code> / <code>&&</code>.')}</p>
                <pre style="background:#f4f5f6;padding:8px;border-radius:4px;">{{/* single check */}}
{{ row.pago == 1 }}

{{/* OR inside one block (recommended) */}}
{{ row.valor_a != 0 or row.valor_b != 0 or row.valor_c }}

{{/* OR across multiple blocks (also works) */}}
{{ row.valor_a != 0 }} || {{ row.valor_b != 0 }} || {{ row.valor_c }}

{{/* AND */}}
{{ row.status == "Aprovado" and row.pago == 1 }}</pre>
                <p class="text-muted small" style="margin-top:6px;color:#c0392b;">
                    &#9888; <strong>${__('Common mistake:')}</strong>
                    ${__('Writing')} <code>{{row.campo!=0}} || {{row.outro!=0}}</code> ${__('renders to a string like "True || False" which always passes. Use')} <code>or</code> ${__('inside one block instead.')}
                </p>
            </div>`;
    }

    let panel_html = `
        <div class="template-help-panel" style="display:none;margin-top:8px;">
            <div style="display:flex;gap:24px;flex-wrap:wrap;">
                <div style="flex:1;min-width:220px;">
                    <strong>${__('Document Variables')}</strong>
                    <pre style="background:#f4f5f6;padding:8px;border-radius:4px;margin-top:4px;">{{ doc.name }}
{{ doc.fieldname }}
{{ format_date(doc.date_field) }}
{{ format_currency(doc.amount, "MZN") }}</pre>
                    ${child_section}
                    <strong>${__('Fetch linked document')}</strong>
                    <pre style="background:#f4f5f6;padding:8px;border-radius:4px;margin-top:4px;">{% set t = frappe.get_doc("Turma", doc.turma) %}
Local: {{ t.local }}
Dia: {{ t.dia }}</pre>
                </div>
                <div style="flex:1;min-width:220px;">
                    <strong>${__('WhatsApp Formatting')}</strong>
                    <pre style="background:#f4f5f6;padding:8px;border-radius:4px;margin-top:4px;">*bold*
_italic_
~strikethrough~</pre>
                    <strong>${__('Conditionals &amp; Loops')}</strong>
                    <pre style="background:#f4f5f6;padding:8px;border-radius:4px;margin-top:4px;">{% if doc.observacoes %}
Obs: {{ doc.observacoes }}
{% endif %}

{% set t = frappe.get_doc("Turma", doc.turma) %}
{% for c in t.catequistas %}
- {{ c.nome }}
{% endfor %}</pre>
                </div>
            </div>
        </div>`;

    let toggle_html = `<button class="template-help-toggle btn btn-xs btn-default" style="margin-top:8px;">
        &#128214; ${__('Template Help')}
    </button>`;

    $msg_wrapper.after(panel_html);
    $msg_wrapper.after(toggle_html);

    if (frm._help_open) {
        $msg_wrapper.siblings('.template-help-panel').show();
        $msg_wrapper.siblings('.template-help-toggle').text(`\u{1F4D6} ${__('Template Help')} \u25B2`);
    }

    $msg_wrapper.siblings('.template-help-toggle').on('click', function () {
        let $panel = $msg_wrapper.siblings('.template-help-panel');
        frm._help_open = !frm._help_open;
        $panel.toggle(frm._help_open);
        $(this).text(frm._help_open
            ? `\u{1F4D6} ${__('Template Help')} \u25B2`
            : `\u{1F4D6} ${__('Template Help')}`
        );
    });
}

// ─── Preview Dialog ──────────────────────────────────────────────────────────

function show_preview_dialog(frm) {
    frappe.call({
        method: 'frappe.client.get_list',
        args: {
            doctype: frm.doc.document_type,
            limit_page_length: 10,
            order_by: 'creation desc'
        },
        callback: function (r) {
            if (!r.message || r.message.length === 0) {
                frappe.msgprint(__('No documents found for preview'));
                return;
            }

            let options = r.message.map(d => d.name);

            let dialog = new frappe.ui.Dialog({
                title: __('Preview Message'),
                fields: [
                    {
                        fieldname: 'docname',
                        fieldtype: 'Select',
                        label: __('Select Document'),
                        options: options,
                        default: options[0],
                        reqd: 1
                    },
                    { fieldname: 'preview_section', fieldtype: 'Section Break' },
                    { fieldname: 'preview_html', fieldtype: 'HTML' }
                ],
                primary_action_label: __('Refresh Preview'),
                primary_action: function (values) {
                    render_preview(frm, values.docname, dialog);
                }
            });

            dialog.show();
            render_preview(frm, options[0], dialog);
        }
    });
}

function render_preview(frm, docname, dialog) {
    frappe.call({
        method: 'whatsapp_notifications.whatsapp_notifications.doctype.whatsapp_notification_rule.whatsapp_notification_rule.preview_message',
        args: { rule_name: frm.doc.name, docname: docname },
        callback: function (r) {
            if (!r.message) return;

            let html = '';

            if (r.message.row_previews && r.message.row_previews.length > 0) {
                let rows_html = r.message.row_previews.map((rp, i) => `
                    <div class="mb-3">
                        <label class="text-muted">${__('Row')} ${i + 1} — ${frappe.utils.escape_html(rp.phone)}:</label>
                        <div class="whatsapp-preview p-3 rounded" style="background:#DCF8C6;white-space:pre-wrap;font-family:system-ui,-apple-system,sans-serif;">
                            ${frappe.utils.escape_html(rp.message || __('Empty message'))}
                        </div>
                    </div>
                `).join('');

                let total_note = r.message.recipients.length > 5
                    ? `<p class="text-muted small">${__('Showing first 5 of')} ${r.message.recipients.length} ${__('recipients')}</p>`
                    : '';

                html = `
                    <div>
                        <div class="mb-3">
                            <label class="text-muted">${__('Recipients')} (${r.message.recipients.length}):</label>
                            <div class="font-weight-bold">${r.message.recipients.join(', ') || __('No recipients found')}</div>
                        </div>
                        ${total_note}${rows_html}
                    </div>`;
            } else {
                html = `
                    <div>
                        <div class="mb-3">
                            <label class="text-muted">${__('Recipients')}:</label>
                            <div class="font-weight-bold">${r.message.recipients.join(', ') || __('No recipients found')}</div>
                        </div>
                        <div>
                            <label class="text-muted">${__('Message')}:</label>
                            <div class="whatsapp-preview p-3 rounded" style="background:#DCF8C6;white-space:pre-wrap;font-family:system-ui,-apple-system,sans-serif;">
                                ${frappe.utils.escape_html(r.message.message || __('Empty message'))}
                            </div>
                        </div>
                    </div>`;
            }

            dialog.fields_dict.preview_html.$wrapper.html(html);
        }
    });
}

// ─── Test Send Dialog ────────────────────────────────────────────────────────

function show_test_dialog(frm) {
    let dialog = new frappe.ui.Dialog({
        title: __('Test WhatsApp Notification'),
        fields: [
            {
                fieldname: 'test_phone',
                fieldtype: 'Data',
                label: __('Test Phone Number'),
                reqd: 1,
                description: __('Enter a phone number to receive the test message')
            },
            {
                fieldname: 'test_docname',
                fieldtype: 'Dynamic Link',
                label: __('Test Document'),
                options: 'test_doctype',
                reqd: 1
            },
            {
                fieldname: 'test_doctype',
                fieldtype: 'Data',
                hidden: 1,
                default: frm.doc.document_type
            }
        ],
        primary_action_label: __('Send Test'),
        primary_action: function (values) {
            frappe.call({
                method: 'whatsapp_notifications.whatsapp_notifications.doctype.whatsapp_notification_rule.whatsapp_notification_rule.preview_message',
                args: { rule_name: frm.doc.name, docname: values.test_docname },
                callback: function (r) {
                    if (r.message && r.message.message) {
                        frappe.call({
                            method: 'whatsapp_notifications.whatsapp_notifications.api.send_whatsapp',
                            args: {
                                phone: values.test_phone,
                                message: r.message.message,
                                doctype: frm.doc.document_type,
                                docname: values.test_docname
                            },
                            callback: function (send_r) {
                                if (send_r.message && send_r.message.success) {
                                    dialog.hide();
                                    frappe.show_alert({ message: __('Test message sent!'), indicator: 'green' }, 5);
                                } else {
                                    frappe.msgprint({
                                        title: __('Send Failed'),
                                        indicator: 'red',
                                        message: send_r.message.error || __('Unknown error')
                                    });
                                }
                            }
                        });
                    } else {
                        frappe.msgprint(__('Could not render message template'));
                    }
                }
            });
        }
    });

    dialog.show();
}

// ─── Group Selection Dialog ──────────────────────────────────────────────────

function show_group_selection_dialog(frm) {
    frappe.call({
        method: 'whatsapp_notifications.whatsapp_notifications.api.fetch_whatsapp_groups',
        freeze: true,
        freeze_message: __('Fetching WhatsApp groups...'),
        callback: function (r) {
            if (!r.message || !r.message.success) {
                frappe.msgprint({
                    title: __('Error'),
                    indicator: 'red',
                    message: (r.message && r.message.error) || __('Failed to fetch WhatsApp groups')
                });
                return;
            }

            let groups = r.message.groups;
            if (!groups || groups.length === 0) {
                frappe.msgprint(__('No WhatsApp groups found. Make sure your WhatsApp is connected.'));
                return;
            }

            let options = groups.map(g => ({
                value: g.id,
                label: g.subject + ' (' + g.size + ' members)'
            }));

            let dialog = new frappe.ui.Dialog({
                title: __('Select WhatsApp Group'),
                fields: [
                    {
                        fieldname: 'group',
                        fieldtype: 'Select',
                        label: __('Group'),
                        options: options.map(o => o.value),
                        reqd: 1
                    },
                    {
                        fieldname: 'group_info',
                        fieldtype: 'HTML',
                        options: '<div class="group-list" style="max-height:300px;overflow-y:auto;"></div>'
                    }
                ],
                primary_action_label: __('Select'),
                primary_action: function (values) {
                    let selected = groups.find(g => g.id === values.group);
                    if (selected) {
                        frm.set_value('group_id', selected.id);
                        frm.set_value('group_name', selected.subject);
                        frm.refresh_field('group_id');
                        frm.refresh_field('group_name');
                        dialog.hide();
                        frappe.show_alert({ message: __('Group selected: ') + selected.subject, indicator: 'green' }, 3);
                    }
                }
            });

            // Populate select with full labels
            let $select = dialog.fields_dict.group.$input;
            $select.empty();
            options.forEach(opt => {
                $select.append($('<option></option>').val(opt.value).text(opt.label));
            });

            if (frm.doc.group_id) {
                $select.val(frm.doc.group_id);
            }

            dialog.show();
        }
    });
}
