// WhatsApp Notification Rule - Client Script

const RECIPIENT_HINTS = {
    'Field Value':    'Reads the phone number from the document field selected below.',
    'Fixed Number':   'Always sends to the specific phone numbers you enter below.',
    'Both':           'Sends to both the document field phone AND the fixed numbers.',
    'Group':          'Sends to a WhatsApp group — click "Select Group" to choose one.',
    'Phone and Group':'Sends to the document field phone AND the WhatsApp group.'
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

const PHONE_FIELD_TYPES   = ['Data', 'Phone', 'Int'];
const DATE_FIELD_TYPES    = ['Date', 'Datetime'];

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
        update_phone_field_required(frm);

        if (frm.doc.document_type) {
            load_all_field_options(frm);
            if (frm.doc.use_child_table) {
                load_child_table_options(frm);
                if (frm.doc.child_table) {
                    load_child_phone_field_options(frm);
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
        let needs_group = ['Group', 'Phone and Group'].includes(frm.doc.recipient_type);
        let needs_fixed = ['Fixed Number', 'Both'].includes(frm.doc.recipient_type);

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

        if (frm.doc.use_child_table && frm.doc.document_type) {
            load_child_table_options(frm);
        } else {
            frm.set_value('child_table', '');
            frm.set_value('child_phone_field', '');
        }
        setup_template_help(frm);
    },

    child_table: function (frm) {
        frm.set_value('child_phone_field', '');
        if (frm.doc.child_table && frm.doc.document_type) {
            load_child_phone_field_options(frm);
        }
    }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function update_phone_field_required(frm) {
    let needs_phone = ['Field Value', 'Both', 'Phone and Group'].includes(frm.doc.recipient_type);
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

            // Phone-like fields for phone_field selector
            let phone_options = all_fields
                .filter(f => PHONE_FIELD_TYPES.includes(f.fieldtype))
                .map(f => ({ label: `${f.label} (${f.fieldname})`, value: f.fieldname }));
            phone_options.unshift({ label: '', value: '' });

            // All fields for value_changed (watch any field)
            let all_options = all_fields
                .map(f => ({ label: `${f.label} — ${f.fieldtype} (${f.fieldname})`, value: f.fieldname }));
            all_options.unshift({ label: '', value: '' });

            // Date/Datetime fields for date_field
            let date_options = all_fields
                .filter(f => DATE_FIELD_TYPES.includes(f.fieldtype))
                .map(f => ({ label: `${f.label} (${f.fieldname})`, value: f.fieldname }));
            date_options.unshift({ label: '', value: '' });

            set_field_options(frm, 'phone_field', phone_options);
            set_field_options(frm, 'value_changed', all_options);
            set_field_options(frm, 'date_field', date_options);
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

function load_child_phone_field_options(frm) {
    if (!frm.doc.document_type || !frm.doc.child_table) return;

    frappe.call({
        method: 'whatsapp_notifications.whatsapp_notifications.doctype.whatsapp_notification_rule.whatsapp_notification_rule.get_child_table_fields',
        args: {
            doctype: frm.doc.document_type,
            child_table_field: frm.doc.child_table
        },
        callback: function (r) {
            if (!r.message) return;
            let options = [''].concat(r.message.map(f => f.fieldname));
            let field = frm.get_field('child_phone_field');
            if (field) {
                field.df.options = options.join('\n');
                field.refresh();
            }
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
                <p class="text-muted small" style="margin-top:4px;">${__('Row Condition examples:')}</p>
                <pre style="background:#f4f5f6;padding:8px;border-radius:4px;">{{ row.pago == 1 }}
{{ row.status == "Aprovado" }}</pre>
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
