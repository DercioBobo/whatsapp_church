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
            set_select_options(frm, 'phone_field', data.phone_fields, true);
            set_select_options(frm, 'name_field', data.data_fields, true);
            set_select_options(frm, 'filter_field', data.all_fields, true);
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


// ---------------------------------------------------------------------------
// Run Now
// ---------------------------------------------------------------------------

function run_now(frm) {
    frappe.confirm(
        __('Executar a regra de aniversários agora para hoje?'),
        function () {
            frappe.show_alert({ message: __('Processando...'), indicator: 'blue' }, 5);

            frm.call({
                method: 'run_now',
                freeze: true,
                freeze_message: __('A enviar notificações de aniversário...'),
                callback: function (r) {
                    if (r.message) {
                        var res = r.message;
                        var msg = __('Enviado para {0} destinatário(s).', [res.sent]);

                        if (res.errors && res.errors.length > 0) {
                            msg += '<br>' + __('Erros: {0}', [res.errors.length]);
                            frappe.msgprint({
                                title: __('Resultado'),
                                indicator: 'orange',
                                message: msg + '<br><pre>' + res.errors.join('\n') + '</pre>'
                            });
                        } else {
                            frappe.show_alert({ message: msg, indicator: 'green' }, 6);
                        }

                        frm.reload_doc();
                    }
                }
            });
        }
    );
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
    frm.call({
        method: 'preview_for_document',
        args: { docname: docname },
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
