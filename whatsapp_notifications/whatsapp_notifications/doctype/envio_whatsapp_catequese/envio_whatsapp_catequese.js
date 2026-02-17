// Envio WhatsApp Catequese - Client Script

frappe.ui.form.on('Envio WhatsApp Catequese', {
    refresh: function (frm) {
        // Color-coded status indicator
        if (frm.doc.status) {
            let indicator = {
                'Rascunho': 'orange',
                'Enviando': 'blue',
                'Enviado': 'green',
                'Enviado Parcialmente': 'yellow',
                'Falhou': 'red'
            }[frm.doc.status] || 'grey';
            frm.page.set_indicator(frm.doc.status, indicator);
        }

        // Make form read-only after sending
        if (frm.doc.status && frm.doc.status !== 'Rascunho') {
            frm.set_read_only(true);
            frm.disable_save();
        }

        // Render result summary if sent
        if (frm.doc.status && frm.doc.status !== 'Rascunho') {
            render_resultado(frm);
        }
    },

    tipo_destinatario: function (frm) {
        // Clear link fields when type changes
        frm.set_value('catecumeno', '');
        frm.set_value('catequista', '');
        frm.set_value('turma', '');
        frm.set_value('preparacao_sacramento', '');
        frm.set_value('numeros_manuais', '');
    },

    adicionar_destinatarios: function (frm) {
        if (!frm.doc.tipo_destinatario) {
            frappe.msgprint(__('Seleccione o tipo de destinatário primeiro'));
            return;
        }

        // Save first if dirty, then call server method
        let do_add = function () {
            frappe.call({
                method: 'adicionar_destinatarios',
                doc: frm.doc,
                freeze: true,
                freeze_message: __('Adicionando destinatários...'),
                callback: function (r) {
                    if (r.message) {
                        frm.reload_doc();
                        frappe.show_alert({
                            message: __('{0} destinatário(s) adicionado(s). Total: {1}',
                                [r.message.added, r.message.total]),
                            indicator: 'green'
                        }, 5);
                    }
                }
            });
        };

        if (frm.is_dirty()) {
            frm.save().then(do_add);
        } else {
            do_add();
        }
    },

    enviar: function (frm) {
        if (!frm.doc.destinatarios || frm.doc.destinatarios.length === 0) {
            frappe.msgprint(__('Adicione pelo menos um destinatário'));
            return;
        }

        if (!frm.doc.mensagem) {
            frappe.msgprint(__('Escreva a mensagem'));
            return;
        }

        let count = frm.doc.destinatarios.length;

        frappe.confirm(
            __('Enviar mensagem WhatsApp para {0} destinatário(s)?', [count]),
            function () {
                // Save first if dirty
                let do_send = function () {
                    frappe.call({
                        method: 'enviar_mensagens',
                        doc: frm.doc,
                        freeze: true,
                        freeze_message: __('Enviando mensagens WhatsApp... Aguarde.'),
                        callback: function (r) {
                            if (r.message) {
                                frm.reload_doc();
                                let msg = __('Envio concluído: {0} enviado(s), {1} falhado(s) de {2} total.',
                                    [r.message.enviados, r.message.falhados, r.message.total]);
                                let indicator = r.message.falhados === 0 ? 'green' :
                                    (r.message.enviados === 0 ? 'red' : 'orange');
                                frappe.show_alert({message: msg, indicator: indicator}, 10);
                            }
                        }
                    });
                };

                if (frm.is_dirty()) {
                    frm.save().then(do_send);
                } else {
                    do_send();
                }
            }
        );
    }
});

function render_resultado(frm) {
    if (!frm.fields_dict.resultado_html) return;

    let total = frm.doc.total_destinatarios || 0;
    let enviados = frm.doc.total_enviados || 0;
    let falhados = frm.doc.total_falhados || 0;

    let status_color = {
        'Enviado': '#28a745',
        'Enviado Parcialmente': '#ffc107',
        'Falhou': '#dc3545',
        'Enviando': '#007bff'
    }[frm.doc.status] || '#6c757d';

    let html = `
        <div style="padding: 15px; border-radius: 8px; background: #f8f9fa; border-left: 4px solid ${status_color};">
            <h5 style="margin: 0 0 10px; color: ${status_color};">${frm.doc.status}</h5>
            <div style="display: flex; gap: 30px;">
                <div>
                    <span style="color: #6c757d; font-size: 12px;">Total</span><br>
                    <strong style="font-size: 20px;">${total}</strong>
                </div>
                <div>
                    <span style="color: #28a745; font-size: 12px;">Enviados</span><br>
                    <strong style="font-size: 20px; color: #28a745;">${enviados}</strong>
                </div>
                <div>
                    <span style="color: #dc3545; font-size: 12px;">Falhados</span><br>
                    <strong style="font-size: 20px; color: #dc3545;">${falhados}</strong>
                </div>
            </div>
        </div>
    `;

    // Show failed recipients details if any
    if (falhados > 0 && frm.doc.destinatarios) {
        let failed_rows = frm.doc.destinatarios.filter(r => r.status_envio === 'Falhou');
        if (failed_rows.length > 0) {
            html += `<div style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 4px;">
                <strong>${__('Falhas de envio')}:</strong><br>`;
            failed_rows.forEach(function (row) {
                let name_part = row.nome ? row.nome + ' - ' : '';
                let error_part = row.erro ? ' (' + frappe.utils.escape_html(row.erro) + ')' : '';
                html += `<div style="margin: 3px 0; font-size: 12px;">
                    &bull; ${frappe.utils.escape_html(name_part)}${frappe.utils.escape_html(row.contacto)}${error_part}
                </div>`;
            });
            html += '</div>';
        }
    }

    frm.fields_dict.resultado_html.$wrapper.html(html);
}

// List view settings
frappe.listview_settings['Envio WhatsApp Catequese'] = {
    get_indicator: function (doc) {
        let colors = {
            'Rascunho': 'orange',
            'Enviando': 'blue',
            'Enviado': 'green',
            'Enviado Parcialmente': 'yellow',
            'Falhou': 'red'
        };
        return [doc.status, colors[doc.status] || 'grey', 'status,=,' + doc.status];
    }
};
