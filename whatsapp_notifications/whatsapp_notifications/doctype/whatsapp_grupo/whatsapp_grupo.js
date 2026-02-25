frappe.ui.form.on('WhatsApp Grupo', {
    refresh: function(frm) {
        if (frm.doc.grupo_id) {
            frm.page.set_indicator(__('Ativo'), 'green');
        } else {
            frm.page.set_indicator(__('Sem ID'), 'orange');
        }

        if (frm.doc.grupo_id && frm.doc.source_doctype && frm.doc.source_docname) {
            frm.add_custom_button(__('Actualizar Membros'), function() {
                frappe.confirm(
                    __('Adicionar todos os membros actuais do documento de origem ao grupo WhatsApp?'),
                    function() {
                        frm.call({
                            method: 'update_members',
                            doc: frm.doc,
                            freeze: true,
                            freeze_message: __('Actualizando membros...'),
                            callback: function(r) {
                                if (r.message && r.message.success) {
                                    frappe.show_alert({
                                        message: __('Grupo actualizado: {0} membros', [r.message.count]),
                                        indicator: 'green'
                                    }, 5);
                                    frm.reload_doc();
                                } else {
                                    frappe.msgprint({
                                        title: __('Erro'),
                                        indicator: 'red',
                                        message: (r.message && r.message.error) || __('Falha ao actualizar membros')
                                    });
                                }
                            }
                        });
                    }
                );
            }).addClass('btn-primary');
        }

        if (frm.doc.source_doctype && frm.doc.source_docname) {
            frm.add_custom_button(__('Ver Documento'), function() {
                frappe.set_route('Form', frm.doc.source_doctype, frm.doc.source_docname);
            });
        }
    }
});

frappe.listview_settings['WhatsApp Grupo'] = {
    get_indicator: function(doc) {
        if (doc.grupo_id) return [__('Ativo'), 'green', 'grupo_id,!=,'];
        return [__('Sem ID'), 'orange', 'grupo_id,=,'];
    }
};
