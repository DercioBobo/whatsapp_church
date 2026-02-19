// Envio WhatsApp Catequese - WhatsApp-styled Client Script

const WA_COLORS = {
    green: '#25D366',
    dark_green: '#128C7E',
    teal: '#075E54',
    light_bg: '#ECE5DD',
    chat_bg: '#DCF8C6',
    white: '#FFFFFF',
    grey_text: '#667781',
    blue_check: '#53BDEB',
    red: '#dc3545'
};

frappe.ui.form.on('Envio WhatsApp Catequese', {
    refresh: function (frm) {
        // Hide standard sidebar and header noise
        frm.page.set_indicator('');
        frm.set_df_property('mensagem', 'hidden', 1);
        frm.set_df_property('destinatarios', 'hidden', 1);

        render_mensagem_area(frm);
        render_recipients_area(frm);
        render_enviar_area(frm);

        if (frm.doc.status && frm.doc.status !== 'Rascunho') {
            render_resultado(frm);
        }

        // Status indicator
        if (frm.doc.status) {
            let indicator = {
                'Rascunho': 'orange', 'Enviando': 'blue', 'Enviado': 'green',
                'Enviado Parcialmente': 'yellow', 'Falhou': 'red'
            }[frm.doc.status] || 'grey';
            frm.page.set_indicator(frm.doc.status, indicator);
        }

        // Read-only after sending
        if (frm.doc.status && frm.doc.status !== 'Rascunho') {
            frm.disable_save();
        }
    }
});

// ============================================================
// Message area - WhatsApp chat bubble style
// ============================================================
function render_mensagem_area(frm) {
    if (!frm.fields_dict.mensagem_html) return;
    let is_draft = frm.doc.status === 'Rascunho';
    let msg = frm.doc.mensagem || '';

    let html = `
    <div class="wa-message-section" style="margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: ${WA_COLORS.teal};
                display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
            </div>
            <div>
                <div style="font-weight: 600; font-size: 15px; color: ${WA_COLORS.teal};">Mensagem</div>
                <div style="font-size: 11px; color: ${WA_COLORS.grey_text};">Formata\u00e7\u00e3o: *negrito* _it\u00e1lico_ ~riscado~</div>
            </div>
        </div>`;

    if (is_draft) {
        html += `
        <div style="background: ${WA_COLORS.light_bg}; border-radius: 12px; padding: 12px;">
            <textarea class="wa-message-input" placeholder="Escreva a sua mensagem..."
                style="width: 100%; min-height: 100px; border: none; background: ${WA_COLORS.white};
                border-radius: 8px; padding: 12px; font-size: 14px; resize: vertical;
                outline: none; font-family: inherit;">${frappe.utils.escape_html(msg)}</textarea>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
                <button class="wa-attach-btn" title="Anexar ficheiro"
                    style="display: flex; align-items: center; gap: 6px; padding: 6px 14px;
                    border: 1px solid #ccc; border-radius: 16px; background: white;
                    color: #555; font-size: 12px; cursor: pointer; transition: all .15s;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#555">
                        <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
                    </svg>
                    Anexar Ficheiro
                </button>
                ${frm.doc.anexo ? `
                <div class="wa-attachment-preview" style="display: flex; align-items: center; gap: 6px;
                    padding: 4px 10px; background: #e8f5e9; border-radius: 12px; font-size: 12px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="${WA_COLORS.dark_green}">
                        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h5v7h7v9H6z"/>
                    </svg>
                    <span style="color: ${WA_COLORS.teal}; font-weight: 500; max-width: 200px;
                        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${frappe.utils.escape_html(frm.doc.anexo.split('/').pop())}
                    </span>
                    <span class="wa-attach-remove" style="cursor: pointer; color: #999; font-size: 16px;
                        line-height: 1; margin-left: 2px;">&times;</span>
                </div>` : ''}
            </div>
        </div>`;
    } else {
        let attachment_html = '';
        if (frm.doc.anexo) {
            let fname = frm.doc.anexo.split('/').pop();
            attachment_html = `
            <div style="display: flex; align-items: center; gap: 6px; padding: 6px 8px;
                background: rgba(0,0,0,0.05); border-radius: 6px; margin-bottom: 6px; font-size: 12px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${WA_COLORS.teal}">
                    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h5v7h7v9H6z"/>
                </svg>
                <span style="color: ${WA_COLORS.teal}; font-weight: 500;">${frappe.utils.escape_html(fname)}</span>
            </div>`;
        }
        html += `
        <div style="background: ${WA_COLORS.light_bg}; border-radius: 12px; padding: 16px;">
            <div style="background: ${WA_COLORS.chat_bg}; border-radius: 8px; padding: 12px;
                max-width: 85%; position: relative;">
                ${attachment_html}
                <div style="white-space: pre-wrap; font-size: 14px;">${frappe.utils.escape_html(msg)}</div>
                <div style="text-align: right; margin-top: 4px;">
                    <span style="font-size: 11px; color: ${WA_COLORS.grey_text};">
                        ${frappe.datetime.str_to_user(frm.doc.data_criacao || frm.doc.creation)}
                    </span>
                    ${frm.doc.status === 'Enviado' ?
                        `<span style="color: ${WA_COLORS.blue_check}; margin-left: 3px;">&#10003;&#10003;</span>` : ''}
                </div>
            </div>
        </div>`;
    }

    html += '</div>';
    frm.fields_dict.mensagem_html.$wrapper.html(html);

    // Bind textarea
    if (is_draft) {
        frm.fields_dict.mensagem_html.$wrapper.find('.wa-message-input').on('change input', function () {
            frm.set_value('mensagem', $(this).val());
        });

        // Bind attach button
        frm.fields_dict.mensagem_html.$wrapper.find('.wa-attach-btn').on('click', function () {
            new frappe.ui.FileUploader({
                doctype: frm.doctype,
                docname: frm.doc.name,
                make_attachments_public: true,
                on_success: function (file) {
                    frm.set_value('anexo', file.file_url);
                    frm.dirty();
                    render_mensagem_area(frm);
                    render_enviar_area(frm);
                }
            });
        });

        // Bind attachment remove
        frm.fields_dict.mensagem_html.$wrapper.find('.wa-attach-remove').on('click', function () {
            frm.set_value('anexo', '');
            frm.dirty();
            render_mensagem_area(frm);
            render_enviar_area(frm);
        });
    }
}

// ============================================================
// Recipients area - Action buttons + chip list
// ============================================================
function render_recipients_area(frm) {
    if (!frm.fields_dict.adicionar_html) return;
    let is_draft = frm.doc.status === 'Rascunho';
    let recipients = frm.doc.destinatarios || [];

    let html = `
    <div class="wa-recipients-section" style="margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: ${WA_COLORS.dark_green};
                display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
            </div>
            <div>
                <div style="font-weight: 600; font-size: 15px; color: ${WA_COLORS.teal};">
                    Destinat\u00e1rios
                    ${recipients.length > 0 ? `<span style="background: ${WA_COLORS.green}; color: white;
                        border-radius: 12px; padding: 1px 8px; font-size: 12px; margin-left: 6px;">
                        ${recipients.length}</span>` : ''}
                </div>
            </div>
        </div>`;

    // Action buttons (only in draft)
    if (is_draft) {
        html += `
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
            <button class="wa-add-btn" data-type="Catecumeno"
                style="display: flex; align-items: center; gap: 6px; padding: 8px 16px;
                border: 1.5px solid ${WA_COLORS.dark_green}; border-radius: 20px; background: white;
                color: ${WA_COLORS.teal}; font-size: 13px; font-weight: 500; cursor: pointer;
                transition: all .15s;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="${WA_COLORS.teal}">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
                Catecumenos
            </button>
            <button class="wa-add-btn" data-type="Catequista"
                style="display: flex; align-items: center; gap: 6px; padding: 8px 16px;
                border: 1.5px solid ${WA_COLORS.dark_green}; border-radius: 20px; background: white;
                color: ${WA_COLORS.teal}; font-size: 13px; font-weight: 500; cursor: pointer;
                transition: all .15s;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="${WA_COLORS.teal}">
                    <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/>
                </svg>
                Catequistas
            </button>
            <button class="wa-add-btn" data-type="Turma"
                style="display: flex; align-items: center; gap: 6px; padding: 8px 16px;
                border: 1.5px solid ${WA_COLORS.dark_green}; border-radius: 20px; background: white;
                color: ${WA_COLORS.teal}; font-size: 13px; font-weight: 500; cursor: pointer;
                transition: all .15s;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="${WA_COLORS.teal}">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
                Turmas
            </button>
            <button class="wa-add-btn" data-type="Preparacao do Sacramento"
                style="display: flex; align-items: center; gap: 6px; padding: 8px 16px;
                border: 1.5px solid ${WA_COLORS.dark_green}; border-radius: 20px; background: white;
                color: ${WA_COLORS.teal}; font-size: 13px; font-weight: 500; cursor: pointer;
                transition: all .15s;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="${WA_COLORS.teal}">
                    <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
                </svg>
                Prep. Sacramento
            </button>
            <button class="wa-add-btn" data-type="Manual"
                style="display: flex; align-items: center; gap: 6px; padding: 8px 16px;
                border: 1.5px solid #999; border-radius: 20px; background: white;
                color: #555; font-size: 13px; font-weight: 500; cursor: pointer;
                transition: all .15s;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#555">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                </svg>
                N\u00fameros Manuais
            </button>
            <button class="wa-add-btn wa-group-btn" data-type="Grupo"
                style="display: flex; align-items: center; gap: 6px; padding: 8px 16px;
                border: 1.5px solid ${WA_COLORS.green}; border-radius: 20px; background: white;
                color: ${WA_COLORS.dark_green}; font-size: 13px; font-weight: 500; cursor: pointer;
                transition: all .15s;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="${WA_COLORS.dark_green}">
                    <path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"/>
                </svg>
                Grupos WhatsApp
            </button>
        </div>`;
    }

    // Recipient chips
    if (recipients.length > 0) {
        if (is_draft) {
            html += `
            <div style="display: flex; justify-content: flex-end; margin-bottom: 6px;">
                <button class="wa-clear-all-btn"
                    style="display: flex; align-items: center; gap: 4px; padding: 4px 12px;
                    border: 1px solid ${WA_COLORS.red}; border-radius: 12px; background: white;
                    color: ${WA_COLORS.red}; font-size: 11px; font-weight: 500; cursor: pointer;
                    transition: all .15s;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="${WA_COLORS.red}">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                    Limpar Todos
                </button>
            </div>`;
        }
        html += `<div style="display: flex; flex-wrap: wrap; gap: 6px; padding: 12px;
            background: #f5f6f7; border-radius: 8px; max-height: 240px; overflow-y: auto;">`;
        recipients.forEach(function (r, idx) {
            let status_icon = '';
            let chip_border = '#e0e0e0';
            if (r.status_envio === 'Enviado') {
                status_icon = `<span style="color: ${WA_COLORS.blue_check};">&#10003;&#10003;</span>`;
                chip_border = WA_COLORS.blue_check;
            } else if (r.status_envio === 'Falhou') {
                status_icon = `<span style="color: ${WA_COLORS.red};">&#10007;</span>`;
                chip_border = WA_COLORS.red;
            }
            let name_display = r.nome ? frappe.utils.escape_html(r.nome) : frappe.utils.escape_html(r.contacto);
            let origin_badge = r.origem ?
                `<span style="font-size: 9px; background: ${WA_COLORS.dark_green}; color: white;
                    border-radius: 3px; padding: 0 4px; margin-left: 4px;">${frappe.utils.escape_html(r.origem)}</span>` : '';

            html += `
            <div class="wa-chip" data-idx="${idx}" style="display: inline-flex; align-items: center; gap: 4px;
                padding: 4px 10px; background: white; border: 1px solid ${chip_border};
                border-radius: 16px; font-size: 12px; white-space: nowrap;"
                title="${frappe.utils.escape_html(r.contacto)}${r.erro ? ' - Erro: ' + frappe.utils.escape_html(r.erro) : ''}">
                <span style="font-weight: 500;">${name_display}</span>
                ${origin_badge}
                ${status_icon}
                ${is_draft ? `<span class="wa-chip-remove" data-idx="${r.idx}" style="cursor: pointer; color: #999;
                    margin-left: 2px; font-size: 14px; line-height: 1;">&times;</span>` : ''}
            </div>`;
        });
        html += '</div>';
    } else {
        html += `
        <div style="text-align: center; padding: 24px; color: ${WA_COLORS.grey_text};
            background: #f5f6f7; border-radius: 8px; font-size: 13px;">
            Nenhum destinat\u00e1rio adicionado. Use os bot\u00f5es acima para seleccionar.
        </div>`;
    }

    html += '</div>';
    frm.fields_dict.adicionar_html.$wrapper.html(html);

    // Bind button hover
    frm.fields_dict.adicionar_html.$wrapper.find('.wa-add-btn').hover(
        function () { $(this).css({'background': WA_COLORS.teal, 'color': 'white'}).find('svg').css('fill', 'white'); },
        function () {
            let type = $(this).data('type');
            let color = type === 'Manual' ? '#555' : (type === 'Grupo' ? WA_COLORS.dark_green : WA_COLORS.teal);
            $(this).css({'background': 'white', 'color': color}).find('svg').css('fill', color);
        }
    );

    // Bind clear all hover
    frm.fields_dict.adicionar_html.$wrapper.find('.wa-clear-all-btn').hover(
        function () { $(this).css({'background': WA_COLORS.red, 'color': 'white'}).find('svg').css('fill', 'white'); },
        function () { $(this).css({'background': 'white', 'color': WA_COLORS.red}).find('svg').css('fill', WA_COLORS.red); }
    );

    // Bind add buttons
    if (is_draft) {
        frm.fields_dict.adicionar_html.$wrapper.find('.wa-add-btn').on('click', function () {
            let type = $(this).data('type');
            if (type === 'Manual') {
                show_manual_dialog(frm);
            } else if (type === 'Grupo') {
                show_group_dialog(frm);
            } else {
                show_multiselect_dialog(frm, type);
            }
        });

        // Bind clear all button
        frm.fields_dict.adicionar_html.$wrapper.find('.wa-clear-all-btn').on('click', function () {
            frappe.confirm(
                __('Tem certeza que deseja remover todos os {0} destinatários?', [recipients.length]),
                function () {
                    let do_clear = function () {
                        frappe.call({
                            method: 'limpar_destinatarios',
                            doc: frm.doc,
                            freeze: true,
                            freeze_message: 'Removendo destinatários...',
                            callback: function () {
                                frm.reload_doc();
                                frappe.show_alert({
                                    message: __('Todos os destinatários foram removidos.'),
                                    indicator: 'green'
                                }, 5);
                            }
                        });
                    };
                    if (frm.is_dirty()) {
                        frm.save().then(do_clear);
                    } else {
                        do_clear();
                    }
                }
            );
        });

        // Bind chip remove
        frm.fields_dict.adicionar_html.$wrapper.find('.wa-chip-remove').on('click', function () {
            let idx = $(this).data('idx');
            // Remove from child table
            frm.doc.destinatarios = frm.doc.destinatarios.filter(r => r.idx !== idx);
            frm.doc.destinatarios.forEach((r, i) => r.idx = i + 1);
            frm.doc.total_destinatarios = frm.doc.destinatarios.length;
            frm.dirty();
            frm.refresh_fields();
            render_recipients_area(frm);
            render_enviar_area(frm);
        });
    }
}

// ============================================================
// Send / Enviar area
// ============================================================
function render_enviar_area(frm) {
    if (!frm.fields_dict.enviar_html) return;
    let is_draft = frm.doc.status === 'Rascunho';
    let count = (frm.doc.destinatarios || []).length;

    if (!is_draft) {
        frm.fields_dict.enviar_html.$wrapper.html('');
        return;
    }

    let has_attachment = !!frm.doc.anexo;
    let disabled = count === 0 || (!frm.doc.mensagem && !has_attachment);
    let btn_style = disabled
        ? `background: #ccc; cursor: not-allowed;`
        : `background: ${WA_COLORS.green}; cursor: pointer;`;

    let html = `
    <div style="display: flex; justify-content: center; padding: 8px 0;">
        <button class="wa-send-btn" ${disabled ? 'disabled' : ''}
            style="display: flex; align-items: center; gap: 10px; padding: 12px 40px;
            border: none; border-radius: 24px; color: white; font-size: 16px; font-weight: 600;
            ${btn_style} transition: all .2s; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
            Enviar para ${count} destinat\u00e1rio${count !== 1 ? 's' : ''}
        </button>
    </div>`;

    frm.fields_dict.enviar_html.$wrapper.html(html);

    if (!disabled) {
        frm.fields_dict.enviar_html.$wrapper.find('.wa-send-btn').hover(
            function () { $(this).css('box-shadow', '0 4px 12px rgba(37,211,102,0.4)'); },
            function () { $(this).css('box-shadow', '0 2px 8px rgba(0,0,0,0.15)'); }
        );

        frm.fields_dict.enviar_html.$wrapper.find('.wa-send-btn').on('click', function () {
            do_enviar(frm);
        });
    }
}

// ============================================================
// Multi-select dialog for Catecumeno / Catequista / Turma
// ============================================================
function show_multiselect_dialog(frm, doctype_type) {
    // Map tipo to actual DocType name
    let doctype_map = {
        'Catecumeno': 'Catecumeno',
        'Catequista': 'Catequista',
        'Turma': 'Turma',
        'Preparacao do Sacramento': 'Preparacao do Sacramento'
    };
    let dt = doctype_map[doctype_type];
    let is_single_select = doctype_type === 'Preparacao do Sacramento';
    let has_padrinhos = doctype_type === 'Catecumeno' || doctype_type === 'Preparacao do Sacramento';
    let title = is_single_select
        ? 'Seleccionar ' + doctype_type
        : 'Seleccionar ' + doctype_type + 's';

    // Fetch records - only request 'name' which is always permitted
    frappe.call({
        method: 'frappe.client.get_list',
        args: {
            doctype: dt,
            fields: ['name'],
            limit_page_length: 0,
            order_by: 'name asc'
        },
        freeze: true,
        freeze_message: 'Carregando...',
        callback: function (r) {
            if (!r.message || r.message.length === 0) {
                frappe.msgprint(__('Nenhum {0} encontrado.', [doctype_type]));
                return;
            }

            let records = r.message.map(function (rec) {
                return {
                    name: rec.name,
                    display: rec.name
                };
            });

            let selected = new Set();

            let dialog_fields = [];
            if (has_padrinhos) {
                dialog_fields.push({
                    fieldname: 'incluir',
                    fieldtype: 'Select',
                    label: 'Enviar para',
                    options: 'Contacto\nPadrinhos\nAmbos',
                    default: 'Contacto'
                });
            }
            dialog_fields.push({
                fieldname: 'search',
                fieldtype: 'Data',
                placeholder: 'Pesquisar...'
            });
            dialog_fields.push({
                fieldname: 'list_html',
                fieldtype: 'HTML'
            });

            let dialog = new frappe.ui.Dialog({
                title: title,
                size: 'large',
                fields: dialog_fields,
                primary_action_label: 'Adicionar Seleccionados',
                primary_action: function () {
                    if (selected.size === 0 && !is_single_select) {
                        frappe.msgprint('Seleccione pelo menos um registo.');
                        return;
                    }
                    dialog.hide();

                    let names = Array.from(selected);
                    let incluir = has_padrinhos ? (dialog.get_value('incluir') || 'Contacto').toLowerCase() : 'contacto';
                    add_from_selection(frm, doctype_type, names, incluir);
                }
            });

            function render_list(filter_text) {
                filter_text = (filter_text || '').toLowerCase();
                let filtered = records.filter(r =>
                    r.display.toLowerCase().includes(filter_text) ||
                    r.name.toLowerCase().includes(filter_text)
                );

                let list_html = '';

                // Select All / Unselect All bar (only for multi-select)
                if (!is_single_select && filtered.length > 0) {
                    let all_filtered_selected = filtered.every(r => selected.has(r.name));
                    list_html += `
                    <div style="display: flex; justify-content: space-between; align-items: center;
                        padding: 6px 12px; border-bottom: 2px solid #eee; background: #fafafa;">
                        <span style="font-size: 12px; color: ${WA_COLORS.grey_text};">
                            ${filtered.length} resultado(s)
                        </span>
                        <div style="display: flex; gap: 8px;">
                            <a href="#" class="wa-select-all" style="font-size: 12px; color: ${WA_COLORS.teal};
                                font-weight: 500; text-decoration: none;">Seleccionar Todos</a>
                            <span style="color: #ddd;">|</span>
                            <a href="#" class="wa-unselect-all" style="font-size: 12px; color: #999;
                                text-decoration: none;">Limpar</a>
                        </div>
                    </div>`;
                }

                list_html += `<div style="max-height: 380px; overflow-y: auto;">`;

                if (filtered.length === 0) {
                    list_html += `<div style="text-align: center; padding: 20px; color: #999;">
                        Nenhum resultado para "${frappe.utils.escape_html(filter_text)}"</div>`;
                } else {
                    filtered.forEach(function (rec) {
                        let is_checked = selected.has(rec.name);
                        let bg = is_checked ? '#e8f5e9' : 'white';
                        list_html += `
                        <div class="wa-select-row" data-name="${frappe.utils.escape_html(rec.name)}"
                            style="display: flex; align-items: center; gap: 12px; padding: 10px 12px;
                            border-bottom: 1px solid #f0f0f0; cursor: pointer; background: ${bg};
                            transition: background .1s;">
                            <div style="width: 20px; height: 20px; border-radius: ${is_single_select ? '50%' : '4px'};
                                border: 2px solid ${is_checked ? WA_COLORS.green : '#ccc'};
                                background: ${is_checked ? WA_COLORS.green : 'white'};
                                display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                ${is_checked ? '<span style="color: white; font-size: 12px;">&#10003;</span>' : ''}
                            </div>
                            <div style="flex: 1;">
                                <div style="font-weight: 500; font-size: 14px;">${frappe.utils.escape_html(rec.display)}</div>
                            </div>
                        </div>`;
                    });
                }

                list_html += '</div>';

                // Counter
                if (!is_single_select) {
                    list_html += `<div style="padding: 8px 12px; font-size: 12px; color: ${WA_COLORS.grey_text};
                        border-top: 1px solid #eee; font-weight: 500;">
                        ${selected.size} seleccionado(s) de ${records.length}
                    </div>`;
                }

                dialog.fields_dict.list_html.$wrapper.html(list_html);

                // Bind Select All / Unselect All
                dialog.fields_dict.list_html.$wrapper.find('.wa-select-all').on('click', function (e) {
                    e.preventDefault();
                    filtered.forEach(r => selected.add(r.name));
                    render_list(dialog.get_value('search'));
                });
                dialog.fields_dict.list_html.$wrapper.find('.wa-unselect-all').on('click', function (e) {
                    e.preventDefault();
                    filtered.forEach(r => selected.delete(r.name));
                    render_list(dialog.get_value('search'));
                });

                // Bind row clicks
                dialog.fields_dict.list_html.$wrapper.find('.wa-select-row').on('click', function () {
                    let name = $(this).data('name');
                    if (is_single_select) {
                        selected.clear();
                        selected.add(name);
                    } else {
                        if (selected.has(name)) {
                            selected.delete(name);
                        } else {
                            selected.add(name);
                        }
                    }
                    render_list(dialog.get_value('search'));
                });

                // Hover effect
                dialog.fields_dict.list_html.$wrapper.find('.wa-select-row').hover(
                    function () {
                        if (!selected.has($(this).data('name'))) {
                            $(this).css('background', '#f9f9f9');
                        }
                    },
                    function () {
                        if (!selected.has($(this).data('name'))) {
                            $(this).css('background', 'white');
                        }
                    }
                );
            }

            render_list('');

            // Search binding
            dialog.fields_dict.search.$input.on('input', function () {
                render_list($(this).val());
            });

            dialog.show();
            // Focus search
            setTimeout(() => dialog.fields_dict.search.$input.focus(), 200);
        }
    });
}

// ============================================================
// Manual number entry dialog
// ============================================================
function show_manual_dialog(frm) {
    let dialog = new frappe.ui.Dialog({
        title: 'Adicionar N\u00fameros Manuais',
        fields: [
            {
                fieldname: 'numeros',
                fieldtype: 'Small Text',
                label: 'N\u00fameros de Telefone',
                description: 'Um n\u00famero por linha, ou separados por v\u00edrgula / barra',
                reqd: 1
            }
        ],
        primary_action_label: 'Adicionar',
        primary_action: function (values) {
            dialog.hide();
            call_adicionar(frm, 'Manual', [values.numeros]);
        }
    });
    dialog.show();
}

// ============================================================
// WhatsApp group selection dialog
// ============================================================
function show_group_dialog(frm) {
    frappe.call({
        method: 'whatsapp_notifications.whatsapp_notifications.api.fetch_whatsapp_groups',
        freeze: true,
        freeze_message: 'Carregando grupos WhatsApp...',
        callback: function (r) {
            if (!r.message || !r.message.success) {
                frappe.msgprint(r.message ? r.message.error : 'Erro ao carregar grupos.');
                return;
            }

            let groups = r.message.groups || [];
            if (groups.length === 0) {
                frappe.msgprint('Nenhum grupo WhatsApp encontrado.');
                return;
            }

            let selected = new Set();

            let dialog = new frappe.ui.Dialog({
                title: 'Seleccionar Grupos WhatsApp',
                size: 'large',
                fields: [
                    {fieldname: 'search', fieldtype: 'Data', placeholder: 'Pesquisar grupo...'},
                    {fieldname: 'list_html', fieldtype: 'HTML'}
                ],
                primary_action_label: 'Adicionar Grupos',
                primary_action: function () {
                    if (selected.size === 0) {
                        frappe.msgprint('Seleccione pelo menos um grupo.');
                        return;
                    }
                    dialog.hide();
                    let selected_groups = groups.filter(g => selected.has(g.id));
                    call_adicionar(frm, 'Grupo', selected_groups);
                }
            });

            function render_list(filter_text) {
                filter_text = (filter_text || '').toLowerCase();
                let filtered = groups.filter(g =>
                    (g.subject || '').toLowerCase().includes(filter_text) ||
                    (g.id || '').toLowerCase().includes(filter_text)
                );

                let list_html = '';

                if (filtered.length > 0) {
                    let all_selected = filtered.every(g => selected.has(g.id));
                    list_html += `
                    <div style="display: flex; justify-content: space-between; align-items: center;
                        padding: 6px 12px; border-bottom: 2px solid #eee; background: #fafafa;">
                        <span style="font-size: 12px; color: ${WA_COLORS.grey_text};">
                            ${filtered.length} grupo(s)
                        </span>
                        <div style="display: flex; gap: 8px;">
                            <a href="#" class="wa-select-all" style="font-size: 12px; color: ${WA_COLORS.teal};
                                font-weight: 500; text-decoration: none;">Seleccionar Todos</a>
                            <span style="color: #ddd;">|</span>
                            <a href="#" class="wa-unselect-all" style="font-size: 12px; color: #999;
                                text-decoration: none;">Limpar</a>
                        </div>
                    </div>`;
                }

                list_html += '<div style="max-height: 380px; overflow-y: auto;">';

                if (filtered.length === 0) {
                    list_html += '<div style="text-align: center; padding: 20px; color: #999;">Nenhum grupo encontrado.</div>';
                } else {
                    filtered.forEach(function (g) {
                        let is_checked = selected.has(g.id);
                        let bg = is_checked ? '#e8f5e9' : 'white';
                        list_html += `
                        <div class="wa-select-row" data-id="${frappe.utils.escape_html(g.id)}"
                            style="display: flex; align-items: center; gap: 12px; padding: 10px 12px;
                            border-bottom: 1px solid #f0f0f0; cursor: pointer; background: ${bg};
                            transition: background .1s;">
                            <div style="width: 20px; height: 20px; border-radius: 4px;
                                border: 2px solid ${is_checked ? WA_COLORS.green : '#ccc'};
                                background: ${is_checked ? WA_COLORS.green : 'white'};
                                display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                ${is_checked ? '<span style="color: white; font-size: 12px;">&#10003;</span>' : ''}
                            </div>
                            <div style="width: 36px; height: 36px; border-radius: 50%; background: ${WA_COLORS.dark_green};
                                display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                                </svg>
                            </div>
                            <div style="flex: 1;">
                                <div style="font-weight: 500; font-size: 14px;">${frappe.utils.escape_html(g.subject)}</div>
                                <div style="font-size: 11px; color: ${WA_COLORS.grey_text};">
                                    ${g.size ? g.size + ' membros' : ''}
                                </div>
                            </div>
                        </div>`;
                    });
                }

                list_html += '</div>';

                list_html += `<div style="padding: 8px 12px; font-size: 12px; color: ${WA_COLORS.grey_text};
                    border-top: 1px solid #eee; font-weight: 500;">
                    ${selected.size} seleccionado(s) de ${groups.length}
                </div>`;

                dialog.fields_dict.list_html.$wrapper.html(list_html);

                // Bind Select All / Unselect All
                dialog.fields_dict.list_html.$wrapper.find('.wa-select-all').on('click', function (e) {
                    e.preventDefault();
                    filtered.forEach(g => selected.add(g.id));
                    render_list(dialog.get_value('search'));
                });
                dialog.fields_dict.list_html.$wrapper.find('.wa-unselect-all').on('click', function (e) {
                    e.preventDefault();
                    filtered.forEach(g => selected.delete(g.id));
                    render_list(dialog.get_value('search'));
                });

                // Bind row clicks
                dialog.fields_dict.list_html.$wrapper.find('.wa-select-row').on('click', function () {
                    let id = $(this).data('id');
                    if (selected.has(id)) {
                        selected.delete(id);
                    } else {
                        selected.add(id);
                    }
                    render_list(dialog.get_value('search'));
                });

                // Hover effect
                dialog.fields_dict.list_html.$wrapper.find('.wa-select-row').hover(
                    function () { if (!selected.has($(this).data('id'))) $(this).css('background', '#f9f9f9'); },
                    function () { if (!selected.has($(this).data('id'))) $(this).css('background', 'white'); }
                );
            }

            render_list('');

            dialog.fields_dict.search.$input.on('input', function () {
                render_list($(this).val());
            });

            dialog.show();
            setTimeout(() => dialog.fields_dict.search.$input.focus(), 200);
        }
    });
}

// ============================================================
// Single server call to add all selected records at once
// ============================================================
function call_adicionar(frm, tipo, names, incluir) {
    let do_call = function () {
        let args = {
            tipo: tipo,
            nomes: JSON.stringify(names)
        };
        if (incluir) {
            args.incluir = incluir;
        }
        frappe.call({
            method: 'adicionar_multiplos',
            doc: frm.doc,
            args: args,
            freeze: true,
            freeze_message: 'Adicionando destinat\u00e1rios...',
            callback: function (r) {
                if (r.message) {
                    frm.reload_doc();
                    let msg = __('{0} destinat\u00e1rio(s) adicionado(s)', [r.message.added]);
                    if (r.message.skipped > 0) {
                        msg += __(', {0} sem contacto', [r.message.skipped]);
                    }
                    frappe.show_alert({
                        message: msg,
                        indicator: r.message.added > 0 ? 'green' : 'orange'
                    }, 7);
                }
            }
        });
    };

    if (frm.is_dirty()) {
        frm.save().then(do_call);
    } else {
        do_call();
    }
}

function add_from_selection(frm, tipo, names, incluir) {
    if (!names.length) return;
    call_adicionar(frm, tipo, names, incluir);
}

// ============================================================
// Send action
// ============================================================
function do_enviar(frm) {
    let count = (frm.doc.destinatarios || []).length;

    if (!frm.doc.mensagem && !frm.doc.anexo) {
        frappe.msgprint('Escreva a mensagem ou anexe um ficheiro.');
        return;
    }

    let attachment_note = '';
    if (frm.doc.anexo) {
        let fname = frm.doc.anexo.split('/').pop();
        attachment_note = `
        <div style="margin-top: 6px; font-size: 12px; color: ${WA_COLORS.teal};">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="${WA_COLORS.teal}" style="vertical-align: middle;">
                <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
            </svg>
            Anexo: ${frappe.utils.escape_html(fname)}
        </div>`;
    }

    frappe.confirm(
        `<div style="text-align: center;">
            <div style="font-size: 40px; margin-bottom: 8px;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="${WA_COLORS.green}">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
            </div>
            <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">
                Enviar mensagem WhatsApp?
            </div>
            <div style="color: ${WA_COLORS.grey_text};">
                ${count} destinat\u00e1rio${count !== 1 ? 's' : ''} ir\u00e3o receber a mensagem
            </div>
            ${attachment_note}
        </div>`,
        function () {
            let do_send = function () {
                frappe.call({
                    method: 'enviar_mensagens',
                    doc: frm.doc,
                    freeze: true,
                    freeze_message: 'Enviando mensagens WhatsApp... Aguarde.',
                    callback: function (r) {
                        if (r.message) {
                            frm.reload_doc();
                            let indicator = r.message.falhados === 0 ? 'green' :
                                (r.message.enviados === 0 ? 'red' : 'orange');
                            frappe.show_alert({
                                message: __('{0} enviado(s), {1} falhado(s) de {2}.',
                                    [r.message.enviados, r.message.falhados, r.message.total]),
                                indicator: indicator
                            }, 10);
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

// ============================================================
// Result area (post-send)
// ============================================================
function render_resultado(frm) {
    if (!frm.fields_dict.resultado_html) return;

    let total = frm.doc.total_destinatarios || 0;
    let enviados = frm.doc.total_enviados || 0;
    let falhados = frm.doc.total_falhados || 0;
    let recipients = frm.doc.destinatarios || [];

    let status_color = {
        'Enviado': WA_COLORS.green,
        'Enviado Parcialmente': '#ffc107',
        'Falhou': WA_COLORS.red,
        'Enviando': '#007bff'
    }[frm.doc.status] || '#6c757d';

    let html = `
    <div style="padding: 20px; border-radius: 12px; background: white;
        border: 1px solid #e0e0e0; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: ${status_color};
                display: flex; align-items: center; justify-content: center;">
                ${frm.doc.status === 'Enviado'
                    ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
                    : frm.doc.status === 'Falhou'
                        ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'
                        : '<svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>'
                }
            </div>
            <div style="font-size: 18px; font-weight: 600; color: ${status_color};">${frm.doc.status}</div>
        </div>
        <div style="display: flex; gap: 24px;">
            <div style="text-align: center; flex: 1; padding: 12px; background: #f8f9fa; border-radius: 8px;">
                <div style="font-size: 28px; font-weight: 700;">${total}</div>
                <div style="font-size: 12px; color: ${WA_COLORS.grey_text};">Total</div>
            </div>
            <div style="text-align: center; flex: 1; padding: 12px; background: #e8f5e9; border-radius: 8px;">
                <div style="font-size: 28px; font-weight: 700; color: ${WA_COLORS.green};">${enviados}</div>
                <div style="font-size: 12px; color: ${WA_COLORS.grey_text};">Enviados</div>
            </div>
            <div style="text-align: center; flex: 1; padding: 12px; background: ${falhados > 0 ? '#fdecea' : '#f8f9fa'}; border-radius: 8px;">
                <div style="font-size: 28px; font-weight: 700; color: ${falhados > 0 ? WA_COLORS.red : '#999'};">${falhados}</div>
                <div style="font-size: 12px; color: ${WA_COLORS.grey_text};">Falhados</div>
            </div>
        </div>`;

    // Failed details
    if (falhados > 0) {
        let failed_rows = recipients.filter(r => r.status_envio === 'Falhou');
        if (failed_rows.length > 0) {
            html += `<div style="margin-top: 12px; padding: 12px; background: #fff3cd; border-radius: 8px;">
                <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px;">Falhas de envio:</div>`;
            failed_rows.forEach(function (row) {
                let name_part = row.nome ? frappe.utils.escape_html(row.nome) + ' - ' : '';
                let error_part = row.erro ? '<br><span style="color: #999;">' + frappe.utils.escape_html(row.erro) + '</span>' : '';
                html += `<div style="margin: 4px 0; font-size: 12px; padding: 4px 0; border-bottom: 1px solid #f0e6c8;">
                    ${name_part}${frappe.utils.escape_html(row.contacto)}${error_part}
                </div>`;
            });
            html += '</div>';
        }
    }

    html += '</div>';
    frm.fields_dict.resultado_html.$wrapper.html(html);
}

// ============================================================
// List view settings
// ============================================================
frappe.listview_settings['Envio WhatsApp Catequese'] = {
    get_indicator: function (doc) {
        let colors = {
            'Rascunho': 'orange', 'Enviando': 'blue', 'Enviado': 'green',
            'Enviado Parcialmente': 'yellow', 'Falhou': 'red'
        };
        return [doc.status, colors[doc.status] || 'grey', 'status,=,' + doc.status];
    }
};
