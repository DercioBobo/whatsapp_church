frappe.ui.form.on('Envio em Massa WhatsApp', {
    refresh(frm) {
        frm.disable_save();
        _render_progress(frm);

        // Auto-refresh when running or stopping
        let is_active = ['Em Execução', 'Parando'].includes(frm.doc.status);
        if (is_active) {
            if (!frm._ems_timer) {
                frm._ems_timer = setInterval(() => {
                    if (['Em Execução', 'Parando'].includes(frm.doc.status)) {
                        frm.reload_doc();
                    } else {
                        clearInterval(frm._ems_timer);
                        frm._ems_timer = null;
                    }
                }, 5000);
            }
        } else {
            if (frm._ems_timer) {
                clearInterval(frm._ems_timer);
                frm._ems_timer = null;
            }
        }
    },

    btn_parar(frm) {
        frappe.confirm(
            __('Parar o envio após a próxima verificação (a cada 10 mensagens)?'),
            () => {
                frm.call('parar').then(r => {
                    if (r.message && r.message.ok) {
                        frappe.show_alert({
                            message: __('Paragem solicitada. O envio irá parar em breve.'),
                            indicator: 'orange'
                        });
                        setTimeout(() => frm.reload_doc(), 1500);
                    }
                });
            }
        );
    },

    btn_cancelar(frm) {
        frappe.confirm(
            __('Cancelar completamente o envio? O Aviso será libertado imediatamente e não poderá ser retomado.'),
            () => {
                frm.call('cancelar').then(r => {
                    if (r.message && r.message.ok) {
                        frappe.show_alert({
                            message: __('Envio cancelado. O Aviso foi libertado.'),
                            indicator: 'red'
                        });
                        setTimeout(() => frm.reload_doc(), 1500);
                    }
                });
            }
        );
    },

    btn_retomar(frm) {
        frappe.confirm(
            __('Retomar o envio? Serão enviados os {0} destinatários pendentes.', [frm.doc.pendentes || '?']),
            () => {
                frm.call('retomar').then(r => {
                    if (r.message && r.message.queued) {
                        frappe.show_alert({
                            message: __('Envio retomado em segundo plano. {0} pendentes.', [r.message.pendentes]),
                            indicator: 'green'
                        });
                        setTimeout(() => frm.reload_doc(), 1500);
                    }
                });
            }
        );
    },

    btn_ver_logs(frm) {
        frappe.route_options = { envio: frm.doc.name };
        frappe.set_route('List', 'Envio em Massa Log');
    }
});

function _render_progress(frm) {
    if (!frm.doc.total) return;
    let done = (frm.doc.enviados || 0) + (frm.doc.falhados || 0);
    let pct = Math.round(done / frm.doc.total * 100);
    let bar_color = frm.doc.falhados > 0 ? '#ff9800' : '#4caf50';
    if (frm.doc.status === 'Em Execução') bar_color = '#2196f3';
    if (frm.doc.status === 'Parando') bar_color = '#ff9800';

    let status_note = frm.doc.status === 'Parando'
        ? ' <span style="color:#e65100;font-size:11px;">⏸ A parar...</span>' : '';

    let html = `
    <div style="padding:10px 0;">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
            <span>${done} / ${frm.doc.total} (${pct}%)${status_note}</span>
            <span>✅ ${frm.doc.enviados || 0} enviados &nbsp; ❌ ${frm.doc.falhados || 0} falhados &nbsp; ⏳ ${frm.doc.pendentes || 0} pendentes</span>
        </div>
        <div style="height:10px;background:#e0e0e0;border-radius:5px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${bar_color};border-radius:5px;transition:width 0.5s;"></div>
        </div>
    </div>`;

    frm.dashboard.set_headline(html);
}
