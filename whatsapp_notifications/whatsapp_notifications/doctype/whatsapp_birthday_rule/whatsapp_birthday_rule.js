// WhatsApp Birthday Rule - Client Script

frappe.ui.form.on('WhatsApp Birthday Rule', {

    refresh: function (frm) {
        // Action buttons (only for saved docs)
        if (!frm.is_new()) {
            frm.add_custom_button(__('Run Now'), function () {
                run_now(frm);
            }, __('Actions'));

            frm.add_custom_button(__('Preview'), function () {
                show_preview_dialog(frm);
            }, __('Actions'));

            frm.add_custom_button(__('Ver Logs'), function () {
                frappe.set_route('List', 'WhatsApp Message Log', {
                    notification_rule: frm.doc.name
                });
            }, __('Actions'));
        }

        // Populate field selects if document_type is already set
        if (frm.doc.document_type) {
            load_birthday_fields(frm);
        }

        setup_template_help(frm);
    },

    document_type: function (frm) {
        // Clear derived field selections
        frm.set_value('birthdate_field', '');
        frm.set_value('phone_field', '');
        frm.set_value('name_field', '');
        frm.set_value('filter_field', '');
        frm.set_value('filter_operator', '');
        frm.set_value('filter_value', '');

        if (frm.doc.document_type) {
            load_birthday_fields(frm);
        }
    },

    phone_field: function (frm) {
        _refresh_multifield_ui(frm, 'phone_field');
    },

    select_group_button: function (frm) {
        show_group_selection_dialog(frm);
    }
});


// ---------------------------------------------------------------------------
// Load field options
// ---------------------------------------------------------------------------

function load_birthday_fields(frm) {
    if (!frm.doc.document_type) return;

    frappe.call({
        method: 'whatsapp_notifications.whatsapp_notifications.doctype.whatsapp_birthday_rule.whatsapp_birthday_rule.get_birthday_doctype_fields',
        args: { doctype: frm.doc.document_type },
        callback: function (r) {
            if (!r.message) return;

            var data = r.message;

            set_select_options(frm, 'birthdate_field', data.date_fields);
            set_select_options(frm, 'name_field', data.data_fields, true);
            set_select_options(frm, 'filter_field', data.all_fields, true);

            // phone_field uses chip picker instead of a plain Select
            _setup_multifield_ui(frm, 'phone_field', data.phone_fields);
        }
    });
}

function set_select_options(frm, fieldname, fields, include_empty) {
    var field = frm.get_field(fieldname);
    if (!field) return;

    var options = [];
    if (include_empty) {
        options.push({ label: '', value: '' });
    }
    (fields || []).forEach(function (f) {
        options.push({ label: f.label, value: f.fieldname });
    });

    field.df.options = options;
    field.refresh();
}

// ─── Multi-field Chip Picker (phone_field) ────────────────────────────────────

function _setup_multifield_ui(frm, field_name, available_fields) {
    var field = frm.fields_dict[field_name];
    if (!field) return;

    var $wrapper = field.$wrapper;
    var ui_class = 'mf-ui-' + field_name.replace(/_/g, '-');

    $wrapper.find('.' + ui_class).remove();
    $wrapper.find('.control-input-wrapper').show();

    if (!available_fields || !available_fields.length) return;

    $wrapper.find('.control-input-wrapper').hide();
    frm['_mf_options_' + field_name] = available_fields;

    var $ui = $('<div class="' + ui_class + '" style="margin-top:4px;">' +
        '<div class="' + ui_class + '-chips" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;min-height:22px;"></div>' +
        '<select class="' + ui_class + '-select form-control input-xs" style="width:auto;max-width:320px;display:inline-block;">' +
        '<option value="">' + __('+ Add field...') + '</option>' +
        '</select></div>');

    $wrapper.append($ui);

    available_fields.forEach(function (f) {
        $ui.find('.' + ui_class + '-select').append(
            $('<option>').val(f.fieldname).text(f.label || f.fieldname)
        );
    });

    $ui.find('.' + ui_class + '-select').on('change', function () {
        var fn = $(this).val();
        if (!fn) return;
        var current = (frm.doc[field_name] || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        if (!current.includes(fn)) {
            current.push(fn);
            frm.set_value(field_name, current.join(', '));
        }
        $(this).val('');
    });

    _render_multifield_chips(frm, field_name, available_fields);
}

function _refresh_multifield_ui(frm, field_name) {
    var available = frm['_mf_options_' + field_name];
    if (!available) return;
    _render_multifield_chips(frm, field_name, available);
}

function _render_multifield_chips(frm, field_name, fields) {
    var field = frm.fields_dict[field_name];
    if (!field) return;

    var $wrapper = field.$wrapper;
    var ui_class = 'mf-ui-' + field_name.replace(/_/g, '-');
    var $chips = $wrapper.find('.' + ui_class + '-chips');
    var $select = $wrapper.find('.' + ui_class + '-select');
    if (!$chips.length) return;

    var current = (frm.doc[field_name] || '').split(',').map(function (f) { return f.trim(); }).filter(Boolean);
    var selected = new Set(current);

    var labelMap = {};
    fields.forEach(function (f) { labelMap[f.fieldname] = f.label || f.fieldname; });

    $chips.empty();

    if (!current.length) {
        $chips.append('<span class="text-muted small" style="line-height:22px;">' + __('No field selected') + '</span>');
    } else {
        current.forEach(function (fn) {
            var label = labelMap[fn] || fn;
            var $chip = $('<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px 3px 12px;border-radius:14px;background:#2196F3;color:#fff;border:1px solid #1565C0;font-size:12px;user-select:none;">' +
                '<span>' + frappe.utils.escape_html(label) + '</span>' +
                '<span class="remove-mf-chip" data-fieldname="' + frappe.utils.escape_html(fn) + '" title="' + __('Remove') + '" style="cursor:pointer;font-size:16px;line-height:1;margin-left:2px;opacity:.85;">×</span>' +
                '</span>');
            $chip.find('.remove-mf-chip').on('click', function () {
                var fn = $(this).data('fieldname');
                var vals = (frm.doc[field_name] || '').split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s && s !== fn; });
                frm.set_value(field_name, vals.join(', '));
            });
            $chips.append($chip);
        });
    }

    if ($select.length) {
        $select.find('option').each(function () {
            var val = $(this).val();
            $(this).toggle(!val || !selected.has(val));
        });
    }
}


// ---------------------------------------------------------------------------
// Run Now
// ---------------------------------------------------------------------------

function run_now(frm) {
    var d = new frappe.ui.Dialog({
        title: __('Executar Regra de Aniversários'),
        fields: [
            {
                fieldname: 'info_html',
                fieldtype: 'HTML'
            },
            {
                fieldname: 'force',
                fieldtype: 'Check',
                label: __('Forçar envio (ignorar verificação de duplicados)'),
                description: __('Ative se já foi executado hoje e quer enviar novamente')
            }
        ],
        primary_action_label: __('Executar Agora'),
        primary_action: function (values) {
            d.hide();
            frappe.show_alert({ message: __('Processando...'), indicator: 'blue' }, 5);

            frappe.call({
                method: 'whatsapp_notifications.whatsapp_notifications.doctype.whatsapp_birthday_rule.whatsapp_birthday_rule.run_now',
                args: { doctype: frm.doc.doctype, docname: frm.doc.name, force: values.force ? 1 : 0 },
                freeze: true,
                freeze_message: __('A enviar notificações de aniversário...'),
                callback: function (r) {
                    if (!r.message) return;
                    var res = r.message;

                    var indicator = res.sent > 0 ? 'green' : (res.errors && res.errors.length ? 'red' : 'orange');
                    var title = __('Resultado da Execução');

                    var msg = '';
                    msg += '<table class="table table-bordered table-sm" style="margin-bottom:0">';
                    msg += '<tr><td>' + __('Data alvo') + '</td><td><strong>' + frappe.utils.escape_html(res.target_date || '') + '</strong></td></tr>';
                    msg += '<tr><td>' + __('Aniversários encontrados') + '</td><td><strong>' + (res.total_matches || 0) + '</strong></td></tr>';
                    msg += '<tr><td>' + __('Enviados') + '</td><td><strong style="color:green">' + (res.sent || 0) + '</strong></td></tr>';
                    if (res.skipped) {
                        msg += '<tr><td>' + __('Ignorados (já enviado hoje)') + '</td><td><strong style="color:orange">' + res.skipped + '</strong></td></tr>';
                    }
                    if (res.errors && res.errors.length) {
                        msg += '<tr><td>' + __('Erros') + '</td><td><strong style="color:red">' + res.errors.length + '</strong></td></tr>';
                    }
                    msg += '</table>';

                    if (res.total_matches === 0) {
                        msg += '<div class="alert alert-warning mt-2 mb-0">' +
                            __('Nenhum aniversário encontrado para a data alvo. Verifique o campo de data e os registos.') +
                            '</div>';
                    }

                    if (res.errors && res.errors.length) {
                        msg += '<pre class="mt-2" style="font-size:11px;max-height:120px;overflow-y:auto">' +
                            frappe.utils.escape_html(res.errors.join('\n')) + '</pre>';
                    }

                    frappe.msgprint({ title: title, indicator: indicator, message: msg });
                    frm.reload_doc();
                }
            });
        }
    });

    var days = frm.doc.days_before || 0;
    var date_info = days === 0
        ? __('Procura aniversários de <strong>hoje</strong>.')
        : __('Procura aniversários daqui a <strong>{0} dia(s)</strong>.', [days]);
    d.fields_dict.info_html.$wrapper.html(
        '<div class="alert alert-info mb-2">' + date_info + '</div>'
    );
    d.show();
}


// ---------------------------------------------------------------------------
// Preview dialog
// ---------------------------------------------------------------------------

function show_preview_dialog(frm) {
    if (!frm.doc.document_type) {
        frappe.msgprint(__('Selecione o Tipo de Documento primeiro.'));
        return;
    }

    frappe.call({
        method: 'frappe.client.get_list',
        args: {
            doctype: frm.doc.document_type,
            limit_page_length: 10,
            order_by: 'creation desc'
        },
        callback: function (r) {
            if (!r.message || r.message.length === 0) {
                frappe.msgprint(__('Nenhum documento encontrado para pré-visualização.'));
                return;
            }

            var options = r.message.map(function (d) { return d.name; });

            var dialog = new frappe.ui.Dialog({
                title: __('Pré-visualizar Mensagens de Aniversário'),
                fields: [
                    {
                        fieldname: 'docname',
                        fieldtype: 'Select',
                        label: __('Selecionar Documento'),
                        options: options,
                        default: options[0],
                        reqd: 1
                    },
                    { fieldname: 'preview_sec', fieldtype: 'Section Break' },
                    { fieldname: 'preview_html', fieldtype: 'HTML' }
                ],
                primary_action_label: __('Atualizar'),
                primary_action: function (values) {
                    render_birthday_preview(frm, values.docname, dialog);
                }
            });

            dialog.show();
            render_birthday_preview(frm, options[0], dialog);
        }
    });
}

function render_birthday_preview(frm, docname, dialog) {
    frappe.call({
        method: 'whatsapp_notifications.whatsapp_notifications.doctype.whatsapp_birthday_rule.whatsapp_birthday_rule.preview_for_document',
        args: { doctype: frm.doc.doctype, docname: frm.doc.name, target_docname: docname },
        callback: function (r) {
            if (!r.message) return;
            var p = r.message;

            var days_label = p.days_until > 0
                ? __('daqui a {0} dia(s)', [p.days_until])
                : __('hoje');

            var html = '<div class="birthday-preview">';
            html += '<p><strong>' + __('Documento') + ':</strong> ' + frappe.utils.escape_html(docname) + '</p>';
            html += '<p><strong>' + __('Aniversário') + ':</strong> ' + frappe.utils.escape_html(p.birthday_date) + ' — ' + days_label + '</p>';
            html += '<p><strong>' + __('Idade') + ':</strong> ' + (p.age || 0) + ' ' + __('anos') + '</p>';
            html += '<hr>';

            if (p.person_message !== undefined) {
                html += '<h6>' + __('Mensagem ao Aniversáriante') + '</h6>';
                if (p.person_phone) {
                    html += '<p class="text-muted small">' + __('Para') + ': ' + frappe.utils.escape_html(p.person_phone) + '</p>';
                }
                html += whatsapp_bubble(p.person_message);
            }

            if (p.group_message !== undefined) {
                html += '<h6 class="mt-3">' + __('Mensagem para o Grupo') + '</h6>';
                if (p.group_id) {
                    html += '<p class="text-muted small">' + __('Grupo') + ': ' + frappe.utils.escape_html(p.group_id) + '</p>';
                }
                html += whatsapp_bubble(p.group_message);
            }

            if (p.additional_message !== undefined) {
                html += '<h6 class="mt-3">' + __('Mensagem para Destinatários Adicionais') + '</h6>';
                if (p.additional_count !== undefined) {
                    html += '<p class="text-muted small">' + p.additional_count + ' ' + __('destinatário(s)') + '</p>';
                }
                html += whatsapp_bubble(p.additional_message);
            }

            html += '</div>';
            dialog.fields_dict.preview_html.$wrapper.html(html);
        }
    });
}

function whatsapp_bubble(text) {
    return '<div style="background:#DCF8C6;padding:10px 14px;border-radius:8px;white-space:pre-wrap;font-family:system-ui,-apple-system,sans-serif;margin-bottom:8px;">'
        + frappe.utils.escape_html(text || '')
        + '</div>';
}


// ---------------------------------------------------------------------------
// Group selection dialog (same pattern as notification_rule.js)
// ---------------------------------------------------------------------------

function show_group_selection_dialog(frm) {
    frappe.call({
        method: 'whatsapp_notifications.whatsapp_notifications.api.fetch_whatsapp_groups',
        freeze: true,
        freeze_message: __('A carregar grupos WhatsApp...'),
        callback: function (r) {
            if (r.message && r.message.success) {
                var groups = r.message.groups;

                if (!groups || groups.length === 0) {
                    frappe.msgprint(__('Nenhum grupo WhatsApp encontrado.'));
                    return;
                }

                var options = groups.map(function (g) {
                    return { value: g.id, label: g.subject + ' (' + g.size + ' membros)' };
                });

                var dialog = new frappe.ui.Dialog({
                    title: __('Selecionar Grupo WhatsApp'),
                    fields: [
                        {
                            fieldname: 'group',
                            fieldtype: 'Select',
                            label: __('Grupo'),
                            options: options.map(function (o) { return o.value; }),
                            reqd: 1
                        },
                        {
                            fieldname: 'group_info',
                            fieldtype: 'HTML',
                            options: '<div style="max-height:300px;overflow-y:auto;"></div>'
                        }
                    ],
                    primary_action_label: __('Selecionar'),
                    primary_action: function (values) {
                        var selected = groups.find(function (g) { return g.id === values.group; });
                        if (selected) {
                            frm.set_value('group_id', selected.id);
                            frm.refresh_field('group_id');
                            dialog.hide();
                            frappe.show_alert({
                                message: __('Grupo selecionado: ') + selected.subject,
                                indicator: 'green'
                            }, 3);
                        }
                    }
                });

                // Populate select with formatted labels
                var $select = dialog.fields_dict.group.$input;
                $select.empty();
                options.forEach(function (opt) {
                    $select.append($('<option></option>').val(opt.value).text(opt.label));
                });

                if (frm.doc.group_id) {
                    $select.val(frm.doc.group_id);
                }

                dialog.show();
            } else {
                frappe.msgprint({
                    title: __('Erro'),
                    indicator: 'red',
                    message: (r.message && r.message.error) || __('Falha ao carregar grupos WhatsApp')
                });
            }
        }
    });
}


// ---------------------------------------------------------------------------
// Template help panel
// ---------------------------------------------------------------------------

function setup_template_help(frm) {
    if (!frm.doc.document_type) return;

    // Remove stale help panels
    frm.fields_dict.person_message.$wrapper.siblings('.birthday-template-help').remove();

    var help_html = `
        <div class="birthday-template-help mt-3 p-3 bg-light rounded">
            <h6><i class="fa fa-info-circle"></i> ${__('Variáveis de Template — Aniversário')}</h6>
            <p class="text-muted small mb-2">${__('Variáveis específicas de aniversário:')}</p>
            <ul class="small mb-2">
                <li><code>{{ age }}</code> — ${__('Idade que a pessoa faz')}</li>
                <li><code>{{ days_until }}</code> — ${__('Dias até ao aniversário (0 = hoje)')}</li>
                <li><code>{{ birthday_date }}</code> — ${__('Data do aniversário este ano')}</li>
            </ul>
            <p class="text-muted small mb-2">${__('Variáveis do documento:')}</p>
            <ul class="small mb-2">
                <li><code>{{ doc.name }}</code> — ${__('ID do documento')}</li>
                <li><code>{{ doc.fieldname }}</code> — ${__('Qualquer campo do documento')}</li>
                <li><code>{{ format_date(doc.data_nascimento) }}</code> — ${__('Data formatada')}</li>
            </ul>
            <p class="text-muted small mb-1">${__('Exemplo de mensagem:')}</p>
            <pre class="small mb-0 p-2 bg-white border rounded">Feliz aniversário, {{ doc.nome_completo }}! 🎂
Hoje faz {{ age }} anos.
Que este dia seja especial!</pre>
        </div>
    `;

    frm.fields_dict.person_message.$wrapper.after(help_html);
}
