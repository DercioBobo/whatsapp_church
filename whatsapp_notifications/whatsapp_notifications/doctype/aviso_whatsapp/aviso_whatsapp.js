// Aviso WhatsApp - Client Script

const WA_COLORS = {
    green: '#25D366',
    dark_green: '#128C7E',
    teal: '#075E54',
    light_bg: '#ECE5DD',
    chat_bg: '#DCF8C6',
    white: '#FFFFFF',
    grey_text: '#667781',
    blue_check: '#53BDEB',
    red: '#dc3545',
    orange: '#f0a500'
};

frappe.ui.form.on('Aviso WhatsApp', {
    refresh: function (frm) {
        frm.page.set_indicator('');

        // Hide all data fields managed by JS
        ['mensagem', 'usar_template', 'anexo', 'fontes',
         'tipo_envio', 'modo_recorrencia', 'data_envio', 'intervalo_valor',
         'intervalo_tipo', 'datas_especificas', 'data_fim', 'proximo_envio',
         'ultimo_envio', 'historico', 'total_enviados', 'total_falhados'
        ].forEach(f => frm.set_df_property(f, 'hidden', 1));

        render_mensagem_area(frm);
        render_destinatarios_area(frm);
        render_agendamento_area(frm);
        render_acoes_area(frm);

        if (frm.doc.status && frm.doc.status !== 'Rascunho') {
            render_historico_area(frm);
        }

        if ((frm.doc.total_falhados || 0) > 0) {
            render_falhados_area(frm);
        }

        let status_colors = {
            'Rascunho': 'orange', 'Agendado': 'blue', 'Enviando': 'blue',
            'Enviado': 'green', 'Recorrente': 'purple', 'Pausado': 'yellow',
            'Conclu\u00eddo': 'green'
        };
        if (frm.doc.status) {
            frm.page.set_indicator(frm.doc.status, status_colors[frm.doc.status] || 'grey');
        }

        if (frm.doc.status && !['Rascunho', 'Pausado'].includes(frm.doc.status)) {
            frm.disable_save();
        }
    }
});

// ============================================================
// Message area
// ============================================================
function render_mensagem_area(frm) {
    if (!frm.fields_dict.mensagem_html) return;
    let is_editable = ['Rascunho', 'Pausado'].includes(frm.doc.status);
    let msg = frm.doc.mensagem || '';
    let use_template = frm.doc.usar_template;

    let html = `
    <div class="wa-mensagem-section" style="margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: ${WA_COLORS.teal};
                display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
            </div>
            <div>
                <div style="font-weight: 600; font-size: 15px; color: ${WA_COLORS.teal};">Mensagem</div>
                <div style="font-size: 11px; color: ${WA_COLORS.grey_text};">
                    Formata\u00e7\u00e3o: *negrito* _it\u00e1lico_ ~riscado~
                </div>
            </div>
        </div>`;

    if (is_editable) {
        html += `
        <div style="background: ${WA_COLORS.light_bg}; border-radius: 12px; padding: 12px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;
                    font-size: 12px; color: ${WA_COLORS.grey_text};">
                    <input type="checkbox" class="wa-template-toggle" ${use_template ? 'checked' : ''}
                        style="width: 14px; height: 14px; cursor: pointer;">
                    Usar template Jinja2 &mdash; <code style="font-size: 11px;">{{ nome }}, {{ doc.campo }}</code>
                </label>
                <button class="wa-template-help-btn" title="Ajuda de vari\u00e1veis"
                    style="padding: 2px 8px; border: 1px solid ${WA_COLORS.teal}; border-radius: 10px;
                    background: white; color: ${WA_COLORS.teal}; font-size: 11px; cursor: pointer;">?</button>
            </div>
            <textarea class="wa-message-input" placeholder="Escreva a sua mensagem..."
                style="width: 100%; min-height: 100px; border: none; background: ${WA_COLORS.white};
                border-radius: 8px; padding: 12px; font-size: 14px; resize: vertical;
                outline: none; font-family: inherit;">${frappe.utils.escape_html(msg)}</textarea>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
                <button class="wa-attach-btn" title="Anexar ficheiro"
                    style="display: flex; align-items: center; gap: 6px; padding: 6px 14px;
                    border: 1px solid #ccc; border-radius: 16px; background: white;
                    color: #555; font-size: 12px; cursor: pointer;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#555">
                        <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
                    </svg>
                    Anexar Ficheiro
                </button>
                <button class="wa-table-helper-btn" title="Auxiliar de Tabela"
                    style="display: flex; align-items: center; gap: 6px; padding: 6px 14px;
                    border: 1px solid #ccc; border-radius: 16px; background: white;
                    color: #555; font-size: 12px; cursor: pointer;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#555">
                        <path d="M3 3h18v18H3V3zm16 16V5H5v14h14zM10 7H6v3h4V7zm0 4H6v3h4v-3zm5-4h-3v3h3V7zm0 4h-3v3h3v-3zm3-4h-2v3h2V7zm0 4h-2v3h2v-3z"/>
                    </svg>
                    Tabela
                </button>
                <button class="wa-fmt-bullet-btn" title="Lista com pontos"
                    style="border:none;background:none;color:#667781;font-size:15px;cursor:pointer;
                    padding:4px 7px;border-radius:10px;">•</button>
                <button class="wa-fmt-dash-btn" title="Lista com traços"
                    style="border:none;background:none;color:#667781;font-size:15px;cursor:pointer;
                    padding:4px 7px;border-radius:10px;">–</button>
                <button class="wa-fmt-arrow-btn" title="Lista com setas"
                    style="border:none;background:none;color:#667781;font-size:15px;cursor:pointer;
                    padding:4px 7px;border-radius:10px;">→</button>
                <button class="wa-fmt-num-btn" title="Lista numerada"
                    style="border:none;background:none;color:#667781;font-size:12px;cursor:pointer;
                    padding:4px 7px;border-radius:10px;">1.</button>
                <button class="wa-fmt-emoji-btn" title="Inserir emoji"
                    style="border:none;background:none;font-size:16px;cursor:pointer;
                    padding:4px 7px;border-radius:10px;">😊</button>
                ${frm.doc.anexo ? `
                <div class="wa-attachment-preview" style="display: flex; align-items: center; gap: 6px;
                    padding: 4px 10px; background: #e8f5e9; border-radius: 12px; font-size: 12px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="${WA_COLORS.dark_green}">
                        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h5v7h7v9H6z"/>
                    </svg>
                    <span style="color: ${WA_COLORS.teal}; font-weight: 500; max-width: 200px;
                        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${frappe.utils.escape_html((frm.doc.anexo || '').split('/').pop())}
                    </span>
                    <span class="wa-attach-remove" style="cursor: pointer; color: #999; font-size: 16px;
                        line-height: 1;">&times;</span>
                </div>` : ''}
            </div>
        </div>`;
    } else {
        let attachment_html = '';
        if (frm.doc.anexo) {
            let fname = (frm.doc.anexo || '').split('/').pop();
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
            <div style="background: ${WA_COLORS.chat_bg}; border-radius: 8px; padding: 12px; max-width: 85%;">
                ${attachment_html}
                <div style="white-space: pre-wrap; font-size: 14px;">${frappe.utils.escape_html(msg)}</div>
                ${use_template ? `<div style="font-size: 10px; color: ${WA_COLORS.grey_text}; margin-top: 4px;">
                    Template Jinja2 activo</div>` : ''}
            </div>
        </div>`;
    }

    html += '</div>';
    frm.fields_dict.mensagem_html.$wrapper.html(html);

    if (is_editable) {
        let $w = frm.fields_dict.mensagem_html.$wrapper;
        $w.find('.wa-message-input').on('input change', function () {
            frm.set_value('mensagem', $(this).val());
        });
        $w.find('.wa-template-toggle').on('change', function () {
            frm.set_value('usar_template', $(this).is(':checked') ? 1 : 0);
            frm.dirty();
        });
        $w.find('.wa-template-help-btn').on('click', function () {
            show_template_help();
        });
        $w.find('.wa-table-helper-btn').on('click', function () {
            frappe.whatsapp.open_table_helper();
        });
        $w.find('.wa-fmt-bullet-btn').on('click', function () {
            _wa_prefix_lines($w.find('.wa-message-input'), () => '• ');
        });
        $w.find('.wa-fmt-dash-btn').on('click', function () {
            _wa_prefix_lines($w.find('.wa-message-input'), () => '- ');
        });
        $w.find('.wa-fmt-arrow-btn').on('click', function () {
            _wa_prefix_lines($w.find('.wa-message-input'), () => '→ ');
        });
        $w.find('.wa-fmt-num-btn').on('click', function () {
            _wa_prefix_lines($w.find('.wa-message-input'), (i) => (i + 1) + '. ');
        });
        $w.find('.wa-fmt-emoji-btn').on('click', function () {
            _wa_open_emoji_picker($(this), $w.find('.wa-message-input'));
        });
        $w.find('.wa-attach-btn').on('click', function () {
            new frappe.ui.FileUploader({
                doctype: frm.doctype,
                docname: frm.doc.name,
                make_attachments_public: true,
                on_success: function (file) {
                    frm.set_value('anexo', file.file_url);
                    frm.dirty();
                    render_mensagem_area(frm);
                }
            });
        });
        $w.find('.wa-attach-remove').on('click', function () {
            frm.set_value('anexo', '');
            frm.dirty();
            render_mensagem_area(frm);
        });
    }
}

// ============================================================
// Destinatários area — fonte cards
// ============================================================
function render_destinatarios_area(frm) {
    if (!frm.fields_dict.destinatarios_html) return;
    let is_editable = ['Rascunho', 'Pausado'].includes(frm.doc.status);
    let fontes = frm.doc.fontes || [];

    let tipo_icons = {
        'Catecumenos': '&#128106;',
        'Catequistas': '&#127891;',
        'Turma': '&#128101;',
        'Preparacao Sacramento': '&#128218;',
        'DocType': '&#128203;',
        'Numeros Manuais': '&#128241;',
        'Grupo WhatsApp': '&#128172;'
    };

    let html = `
    <div class="wa-dest-section" style="margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: ${WA_COLORS.dark_green};
                display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
            </div>
            <div>
                <div style="font-weight: 600; font-size: 15px; color: ${WA_COLORS.teal};">
                    Fontes de Destinat\u00e1rios
                    ${fontes.length > 0 ? `<span style="background: ${WA_COLORS.green}; color: white;
                        border-radius: 12px; padding: 1px 8px; font-size: 12px; margin-left: 6px;">
                        ${fontes.length}</span>` : ''}
                </div>
                <div style="font-size: 11px; color: ${WA_COLORS.grey_text};">
                    Os destinat\u00e1rios ser\u00e3o resolvidos no momento do envio
                </div>
            </div>
        </div>`;

    if (fontes.length > 0) {
        html += `<div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;">`;
        fontes.forEach(function (fonte) {
            let icon = tipo_icons[fonte.tipo_fonte] || '&#128203;';
            let descricao = fonte.descricao || fonte.tipo_fonte;
            let can_preview = fonte.tipo_fonte !== 'Grupo WhatsApp';
            html += `
            <div class="wa-fonte-wrapper" style="border-radius: 10px; overflow: hidden;
                border: 1px solid #e0e0e0; border-left: 4px solid ${WA_COLORS.teal};">
                <div class="wa-fonte-card"
                    data-name="${frappe.utils.escape_html(fonte.name || '')}"
                    data-tipo="${frappe.utils.escape_html(fonte.tipo_fonte || '')}"
                    style="display: flex; align-items: center; gap: 10px; padding: 10px 14px;
                    background: white; ${can_preview ? 'cursor: pointer;' : ''}">
                    <span style="font-size: 20px;">${icon}</span>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; font-size: 13px; color: ${WA_COLORS.teal};">
                            ${frappe.utils.escape_html(fonte.tipo_fonte)}
                        </div>
                        <div style="font-size: 11px; color: ${WA_COLORS.grey_text}; white-space: nowrap;
                            overflow: hidden; text-overflow: ellipsis;">
                            ${frappe.utils.escape_html(descricao)}
                        </div>
                    </div>
                    ${can_preview ? `<span class="wa-fonte-expand-icon"
                        style="color: ${WA_COLORS.grey_text}; font-size: 11px; flex-shrink: 0;
                        user-select: none; padding: 0 2px;">&#9660;</span>` : ''}
                    ${is_editable ? `<button class="wa-fonte-remove"
                        data-name="${frappe.utils.escape_html(fonte.name || '')}"
                        style="border: none; background: none; color: #ccc; font-size: 18px;
                        cursor: pointer; line-height: 1; padding: 0 4px; flex-shrink: 0;"
                        title="Remover fonte">&times;</button>` : ''}
                </div>
                ${can_preview ? `
                <div class="wa-fonte-preview-area" style="display: none; padding: 8px 14px;
                    background: #f8fffe; border-top: 1px solid #e0e0e0;
                    max-height: 200px; overflow-y: auto; font-size: 12px;">
                </div>` : ''}
            </div>`;
        });
        html += '</div>';
    } else {
        html += `
        <div style="text-align: center; padding: 24px; color: ${WA_COLORS.grey_text};
            background: #f5f6f7; border-radius: 8px; font-size: 13px; margin-bottom: 10px;">
            Nenhuma fonte adicionada. Clique em <strong>+ Adicionar Fonte</strong>.
        </div>`;
    }

    if (is_editable) {
        html += `
        <button class="wa-add-fonte-btn"
            style="display: flex; align-items: center; gap: 6px; padding: 8px 18px;
            border: 1.5px dashed ${WA_COLORS.dark_green}; border-radius: 20px; background: white;
            color: ${WA_COLORS.teal}; font-size: 13px; font-weight: 500; cursor: pointer;
            transition: all .15s;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="${WA_COLORS.teal}">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Adicionar Fonte
        </button>`;
    }

    html += '</div>';
    frm.fields_dict.destinatarios_html.$wrapper.html(html);

    let $wd = frm.fields_dict.destinatarios_html.$wrapper;

    if (is_editable) {
        $wd.find('.wa-add-fonte-btn').on('click', function () {
            show_add_fonte_dialog(frm);
        });
        $wd.find('.wa-fonte-remove').on('click', function (e) {
            e.stopPropagation();
            let row_name = $(this).data('name');
            // Remove from Frappe model locals
            if (frappe.model.locals && frappe.model.locals['Aviso WhatsApp Fonte']) {
                delete frappe.model.locals['Aviso WhatsApp Fonte'][row_name];
            }
            frm.doc.fontes = (frm.doc.fontes || []).filter(f => f.name !== row_name);
            frm.doc.fontes.forEach((f, i) => f.idx = i + 1);
            frm.dirty();
            frm.refresh_field('fontes');
            render_destinatarios_area(frm);
        });
    }

    // Preview handler — always active, not just when editable
    $wd.find('.wa-fonte-card').on('click', function (e) {
        if ($(e.target).hasClass('wa-fonte-remove') || $(e.target).closest('.wa-fonte-remove').length) return;
        let tipo = $(this).data('tipo');
        if (!tipo || tipo === 'Grupo WhatsApp') return;

        let $card = $(this);
        let $preview = $card.closest('.wa-fonte-wrapper').find('.wa-fonte-preview-area');
        let $icon = $card.find('.wa-fonte-expand-icon');

        if ($preview.is(':visible')) {
            $preview.slideUp(150);
            $icon.html('&#9660;');
            return;
        }
        $icon.html('&#9650;');
        $preview.slideDown(150);
        if ($preview.data('loaded')) return;

        $preview.html('<div style="color: ' + WA_COLORS.grey_text + '; padding: 4px 0;">A carregar...</div>');

        let row_name = $card.data('name');
        let fonte_row = (frm.doc.fontes || []).find(function (f) { return f.name === row_name; });
        if (!fonte_row) {
            $preview.html('<div style="color: red;">Erro: fonte não encontrada.</div>');
            return;
        }

        let fonte_data = {};
        ['tipo_fonte','filtro_status','nome_registo','incluir_padrinhos',
         'numeros','doctype_fonte','campo_contacto','usar_child_table',
         'child_table_field','campo_contacto_child','filtro_campo','filtro_operador','filtro_valor','filtros'
        ].forEach(function (k) { fonte_data[k] = fonte_row[k] || ''; });

        frappe.call({
            method: 'whatsapp_notifications.whatsapp_notifications.doctype.aviso_whatsapp.aviso_whatsapp.preview_fonte_destinatarios',
            args: { fonte_json: JSON.stringify(fonte_data) },
            callback: function (r) {
                let recipients = r.message || [];
                $preview.data('loaded', true);
                if (!recipients.length) {
                    $preview.html('<div style="color: ' + WA_COLORS.grey_text + '; padding: 4px 0;">Nenhum número encontrado.</div>');
                    return;
                }
                let out = '<div style="font-weight: 600; color: ' + WA_COLORS.teal + '; margin-bottom: 6px;">' +
                    recipients.length + ' número(s)</div>';
                out += recipients.map(function (rec) {
                    let nome_part = rec.nome ? '<span style="color: #555;">' + frappe.utils.escape_html(rec.nome) + '</span> &mdash; ' : '';
                    return '<div style="padding: 3px 0; border-bottom: 1px solid #edf0f2;">' +
                        nome_part +
                        '<code style="font-size: 11px; color: ' + WA_COLORS.teal + ';">' + frappe.utils.escape_html(rec.contacto) + '</code></div>';
                }).join('');
                $preview.html(out);
            }
        });
    });
}

// ============================================================
// Agendamento area
// ============================================================
function render_agendamento_area(frm) {
    if (!frm.fields_dict.agendamento_html) return;
    let is_editable = ['Rascunho', 'Pausado'].includes(frm.doc.status);
    let tipo_envio = frm.doc.tipo_envio || 'Agora';
    let modo = frm.doc.modo_recorrencia || 'Unico';

    let html = `
    <div class="wa-agendamento-section" style="margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: ${WA_COLORS.dark_green};
                display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/>
                </svg>
            </div>
            <div style="font-weight: 600; font-size: 15px; color: ${WA_COLORS.teal};">Quando Enviar</div>
        </div>`;

    if (is_editable) {
        // Send mode toggle
        html += `
        <div style="display: flex; gap: 10px; margin-bottom: 14px;">
            <button class="wa-tipo-btn" data-tipo="Agora"
                style="flex: 1; padding: 10px; border-radius: 20px; font-size: 14px; font-weight: 600;
                cursor: pointer; transition: all .15s; border: 2px solid ${tipo_envio === 'Agora' ? WA_COLORS.green : '#ddd'};
                background: ${tipo_envio === 'Agora' ? WA_COLORS.green : 'white'};
                color: ${tipo_envio === 'Agora' ? 'white' : '#555'};">
                &#9654; Enviar Agora
            </button>
            <button class="wa-tipo-btn" data-tipo="Agendar"
                style="flex: 1; padding: 10px; border-radius: 20px; font-size: 14px; font-weight: 600;
                cursor: pointer; transition: all .15s; border: 2px solid ${tipo_envio === 'Agendar' ? WA_COLORS.teal : '#ddd'};
                background: ${tipo_envio === 'Agendar' ? WA_COLORS.teal : 'white'};
                color: ${tipo_envio === 'Agendar' ? 'white' : '#555'};">
                &#128337; Agendar
            </button>
        </div>`;

        if (tipo_envio === 'Agendar') {
            // Initial date/time
            let data_val = frm.doc.data_envio ? frm.doc.data_envio.substring(0, 16) : '';
            html += `
            <div style="background: #f5f6f7; border-radius: 10px; padding: 14px; margin-bottom: 12px;">
                <label style="font-size: 12px; font-weight: 600; color: ${WA_COLORS.grey_text};
                    display: block; margin-bottom: 6px;">DATA E HORA DE ENVIO</label>
                <input type="datetime-local" class="wa-data-envio" value="${frappe.utils.escape_html(data_val)}"
                    style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px;
                    font-size: 14px; background: white; outline: none;">
            </div>`;

            // Recurrence mode pills
            html += `
            <div style="margin-bottom: 12px;">
                <label style="font-size: 12px; font-weight: 600; color: ${WA_COLORS.grey_text};
                    display: block; margin-bottom: 8px;">RECORR\u00caNCIA</label>
                <div style="display: flex; gap: 8px;">
                    ${[['Unico', 'Uma Vez'], ['Intervalo', 'Intervalo'], ['Datas', 'Datas Espec\u00edficas']].map(([val, label]) => `
                    <button class="wa-modo-btn" data-modo="${val}"
                        style="padding: 6px 16px; border-radius: 16px; font-size: 13px; cursor: pointer;
                        border: 1.5px solid ${modo === val ? WA_COLORS.teal : '#ddd'};
                        background: ${modo === val ? WA_COLORS.teal : 'white'};
                        color: ${modo === val ? 'white' : '#555'};">
                        ${label}
                    </button>`).join('')}
                </div>
            </div>`;

            if (modo === 'Intervalo') {
                let int_val = frm.doc.intervalo_valor || 1;
                let int_tipo = frm.doc.intervalo_tipo || 'dias';
                let data_fim_val = frm.doc.data_fim || '';
                html += `
                <div style="background: #f5f6f7; border-radius: 10px; padding: 14px; margin-bottom: 12px;">
                    <label style="font-size: 12px; font-weight: 600; color: ${WA_COLORS.grey_text};
                        display: block; margin-bottom: 8px;">REPETIR CADA</label>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <input type="number" class="wa-int-valor" min="1" value="${int_val}"
                            style="width: 70px; padding: 6px 10px; border: 1px solid #ddd; border-radius: 8px;
                            font-size: 14px; background: white; outline: none;">
                        <select class="wa-int-tipo" style="padding: 6px 10px; border: 1px solid #ddd;
                            border-radius: 8px; font-size: 14px; background: white; outline: none;">
                            <option value="dias" ${int_tipo === 'dias' ? 'selected' : ''}>Dias</option>
                            <option value="semanas" ${int_tipo === 'semanas' ? 'selected' : ''}>Semanas</option>
                            <option value="meses" ${int_tipo === 'meses' ? 'selected' : ''}>Meses</option>
                        </select>
                    </div>
                    <label style="font-size: 12px; font-weight: 600; color: ${WA_COLORS.grey_text};
                        display: block; margin-top: 10px; margin-bottom: 6px;">TERMINAR EM (opcional)</label>
                    <input type="date" class="wa-data-fim" value="${frappe.utils.escape_html(data_fim_val)}"
                        style="padding: 6px 10px; border: 1px solid #ddd; border-radius: 8px;
                        font-size: 14px; background: white; outline: none;">
                </div>`;
            } else if (modo === 'Datas') {
                let datas = [];
                try { datas = JSON.parse(frm.doc.datas_especificas || '[]'); } catch(e) {}
                html += `
                <div class="wa-datas-section" style="background: #f5f6f7; border-radius: 10px; padding: 14px; margin-bottom: 12px;">
                    <label style="font-size: 12px; font-weight: 600; color: ${WA_COLORS.grey_text};
                        display: block; margin-bottom: 8px;">DATAS ESPEC\u00cdFICAS</label>
                    <div class="wa-datas-list" style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px;">
                        ${datas.map((d, i) => `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="datetime-local" class="wa-data-item" data-idx="${i}"
                                value="${frappe.utils.escape_html(d.substring(0, 16))}"
                                style="flex: 1; padding: 6px 10px; border: 1px solid #ddd; border-radius: 8px;
                                font-size: 13px; background: white; outline: none;">
                            <button class="wa-data-remove" data-idx="${i}"
                                style="border: none; background: none; color: #ccc; font-size: 18px;
                                cursor: pointer;">&times;</button>
                        </div>`).join('')}
                    </div>
                    <button class="wa-add-data-btn"
                        style="display: flex; align-items: center; gap: 4px; padding: 5px 12px;
                        border: 1px dashed ${WA_COLORS.teal}; border-radius: 12px; background: white;
                        color: ${WA_COLORS.teal}; font-size: 12px; cursor: pointer;">
                        + Adicionar Data
                    </button>
                </div>`;
            }
        }
    } else {
        // Read-only display
        let proximo = frm.doc.proximo_envio;
        let ultimo = frm.doc.ultimo_envio;
        let tipo_label = {
            'Agora': 'Envio Imediato',
            'Agendar': frm.doc.modo_recorrencia === 'Intervalo' ? 'Intervalo Recorrente' :
                       frm.doc.modo_recorrencia === 'Datas' ? 'Datas Espec\u00edficas' : 'Uma Vez'
        }[frm.doc.tipo_envio || 'Agora'];
        html += `
        <div style="background: #f5f6f7; border-radius: 10px; padding: 14px;">
            <div style="font-size: 13px; color: ${WA_COLORS.grey_text}; margin-bottom: 8px;">
                Modo: <strong>${frappe.utils.escape_html(tipo_label)}</strong>
            </div>
            ${proximo ? `<div style="font-size: 13px; color: ${WA_COLORS.teal};">
                Pr\u00f3ximo envio: <strong>${frappe.datetime.str_to_user(proximo)}</strong>
            </div>` : ''}
            ${ultimo ? `<div style="font-size: 13px; color: ${WA_COLORS.grey_text}; margin-top: 4px;">
                \u00daltimo envio: ${frappe.datetime.str_to_user(ultimo)}
            </div>` : ''}
        </div>`;
    }

    html += '</div>';
    frm.fields_dict.agendamento_html.$wrapper.html(html);

    if (is_editable) {
        let $w = frm.fields_dict.agendamento_html.$wrapper;

        $w.find('.wa-tipo-btn').on('click', function () {
            let tipo = $(this).data('tipo');
            if (tipo === 'Agora' && frm.doc.tipo_envio === 'Agora') {
                // Already in "Agora" mode — this click should send immediately
                do_enviar_agora(frm);
            } else {
                frm.set_value('tipo_envio', tipo);
                frm.dirty();
                render_agendamento_area(frm);
                render_acoes_area(frm);
            }
        });

        $w.find('.wa-modo-btn').on('click', function () {
            frm.set_value('modo_recorrencia', $(this).data('modo'));
            frm.dirty();
            render_agendamento_area(frm);
        });

        $w.find('.wa-data-envio').on('change', function () {
            frm.set_value('data_envio', $(this).val() ? $(this).val() + ':00' : '');
            frm.dirty();
        });

        $w.find('.wa-int-valor').on('change', function () {
            frm.set_value('intervalo_valor', parseInt($(this).val()) || 1);
            frm.dirty();
        });

        $w.find('.wa-int-tipo').on('change', function () {
            frm.set_value('intervalo_tipo', $(this).val());
            frm.dirty();
        });

        $w.find('.wa-data-fim').on('change', function () {
            frm.set_value('data_fim', $(this).val() || '');
            frm.dirty();
        });

        // Datas especificas
        $w.find('.wa-add-data-btn').on('click', function () {
            let datas = [];
            try { datas = JSON.parse(frm.doc.datas_especificas || '[]'); } catch(e) {}
            datas.push(frappe.datetime.now_datetime());
            frm.set_value('datas_especificas', JSON.stringify(datas));
            frm.dirty();
            render_agendamento_area(frm);
        });

        $w.find('.wa-data-remove').on('click', function () {
            let idx = parseInt($(this).data('idx'));
            let datas = [];
            try { datas = JSON.parse(frm.doc.datas_especificas || '[]'); } catch(e) {}
            datas.splice(idx, 1);
            frm.set_value('datas_especificas', JSON.stringify(datas));
            frm.dirty();
            render_agendamento_area(frm);
        });

        $w.find('.wa-data-item').on('change', function () {
            let idx = parseInt($(this).data('idx'));
            let datas = [];
            try { datas = JSON.parse(frm.doc.datas_especificas || '[]'); } catch(e) {}
            datas[idx] = $(this).val() ? $(this).val() + ':00' : '';
            frm.set_value('datas_especificas', JSON.stringify(datas));
            frm.dirty();
        });
    }
}

// ============================================================
// Actions area
// ============================================================
function render_acoes_area(frm) {
    // Dynamically add/remove action buttons from page header
    frm.page.clear_primary_action();
    frm.page.clear_secondary_action();
    frm.page.clear_actions_menu();

    let status = frm.doc.status || 'Rascunho';
    let tipo_envio = frm.doc.tipo_envio || 'Agora';

    if (status === 'Rascunho' || status === 'Pausado') {
        if (tipo_envio === 'Agora') {
            frm.page.set_primary_action(__('Enviar Agora'), function () {
                do_enviar_agora(frm);
            }, 'fa fa-send');
        } else {
            frm.page.set_primary_action(__('Agendar'), function () {
                do_agendar(frm);
            }, 'fa fa-clock-o');
        }
        if (status === 'Pausado') {
            frm.page.add_action_item(__('Retomar'), function () {
                frappe.call({
                    method: 'retomar',
                    doc: frm.doc,
                    freeze: true,
                    callback: function () { frm.reload_doc(); }
                });
            });
            frm.page.add_action_item(__('Cancelar Agendamento'), function () {
                frappe.confirm(__('Cancelar o agendamento e voltar a Rascunho?'), function () {
                    frappe.call({
                        method: 'cancelar',
                        doc: frm.doc,
                        freeze: true,
                        callback: function () { frm.reload_doc(); }
                    });
                });
            });
        }
    } else if (['Agendado', 'Recorrente'].includes(status)) {
        frm.page.set_primary_action(__('Pausar'), function () {
            frappe.call({
                method: 'pausar',
                doc: frm.doc,
                freeze: true,
                callback: function () { frm.reload_doc(); }
            });
        }, 'fa fa-pause');
        frm.page.add_action_item(__('Enviar Agora (manual)'), function () {
            do_enviar_agora(frm);
        });
    }

    // Preview always available when there are fontes
    if ((frm.doc.fontes || []).length > 0) {
        frm.page.add_action_item(__('👁 Preview Mensagem'), function () {
            show_preview_mensagem_dialog(frm);
        });
    }
}

// ============================================================
// Preview Mensagem dialog
// ============================================================
function show_preview_mensagem_dialog(frm) {
    // Save first if dirty so the server has the latest data
    let do_preview = function (offset) {
        let limit = 5;
        frappe.call({
            method: 'whatsapp_notifications.whatsapp_notifications.doctype.aviso_whatsapp.aviso_whatsapp.preview_mensagens',
            args: { aviso_name: frm.doc.name, limit: limit, offset: offset || 0 },
            freeze: true,
            freeze_message: __('A resolver destinatários e renderizar mensagens...'),
            callback: function (r) {
                let data = r.message || {};
                let recipients = data.recipients || [];
                let total = data.total || 0;
                let shown_offset = data.offset || 0;

                if (!recipients.length) {
                    frappe.msgprint(__('Nenhum destinatário encontrado nas fontes configuradas.'));
                    return;
                }

                let bubbles_html = recipients.map(function (rec) {
                    let msg_html = frappe.utils.escape_html(rec.mensagem || '').replace(/\n/g, '<br>');
                    return `
                    <div style="margin-bottom:16px;">
                        <div style="font-size:11px;color:#667781;margin-bottom:4px;display:flex;gap:8px;align-items:center;">
                            <span style="font-weight:600;color:#075E54;">${frappe.utils.escape_html(rec.nome || '—')}</span>
                            <span style="font-family:monospace;background:#f0f0f0;border-radius:4px;
                                padding:1px 5px;font-size:10px;">${frappe.utils.escape_html(rec.contacto || '')}</span>
                            ${rec.origem ? `<span style="color:#aaa;font-size:10px;">${frappe.utils.escape_html(rec.origem)}</span>` : ''}
                        </div>
                        <div style="background:#DCF8C6;border-radius:0 8px 8px 8px;padding:10px 14px;
                            max-width:90%;display:inline-block;position:relative;">
                            <div style="white-space:pre-wrap;font-size:13px;line-height:1.5;">${msg_html}</div>
                            <div style="font-size:10px;color:#667781;text-align:right;margin-top:4px;">✓✓</div>
                        </div>
                    </div>`;
                }).join('');

                let showing_end = shown_offset + recipients.length;
                let nav_html = `
                <div style="display:flex;align-items:center;justify-content:space-between;
                    padding-top:10px;border-top:1px solid #eee;margin-top:4px;font-size:12px;color:#667781;">
                    <span>Mostrando <b>${shown_offset + 1}–${showing_end}</b> de <b>${total}</b> destinatários</span>
                    <div style="display:flex;gap:8px;">
                        ${shown_offset > 0 ? `<button class="btn btn-xs btn-default wa-prev-preview"
                            data-offset="${shown_offset - limit}">◀ Anteriores</button>` : ''}
                        ${showing_end < total ? `<button class="btn btn-xs btn-default wa-next-preview"
                            data-offset="${showing_end}">Próximos ▶</button>` : ''}
                    </div>
                </div>`;

                let d = new frappe.ui.Dialog({
                    title: __('Preview de Mensagem — {0} destinatários', [total]),
                    fields: [{
                        fieldtype: 'HTML',
                        fieldname: 'preview_html',
                        options: `<div style="background:#ECE5DD;border-radius:8px;padding:16px 14px;">
                            ${bubbles_html}
                        </div>${nav_html}`
                    }],
                    size: 'large'
                });
                d.show();

                d.$wrapper.find('.wa-prev-preview').on('click', function () {
                    d.hide();
                    do_preview(parseInt($(this).data('offset')));
                });
                d.$wrapper.find('.wa-next-preview').on('click', function () {
                    d.hide();
                    do_preview(parseInt($(this).data('offset')));
                });
            }
        });
    };

    if (frm.is_dirty()) {
        frm.save('Save', function () { do_preview(0); });
    } else {
        do_preview(0);
    }
}

// ============================================================
// Historico area
// ============================================================
function render_historico_area(frm) {
    if (!frm.fields_dict.resultado_html) return;
    let historico = frm.doc.historico || [];
    let total_env = frm.doc.total_enviados || 0;
    let total_fal = frm.doc.total_falhados || 0;

    let html = `
    <div style="padding: 16px; border-radius: 12px; background: white;
        border: 1px solid #e0e0e0; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
        <div style="font-weight: 700; font-size: 15px; color: ${WA_COLORS.teal}; margin-bottom: 14px;">
            Hist\u00f3rico de Envios
        </div>
        <div style="display: flex; gap: 16px; margin-bottom: 16px;">
            <div style="text-align: center; flex: 1; padding: 12px; background: #e8f5e9; border-radius: 8px;">
                <div style="font-size: 28px; font-weight: 700; color: ${WA_COLORS.green};">${total_env}</div>
                <div style="font-size: 12px; color: ${WA_COLORS.grey_text};">Total Enviados</div>
            </div>
            <div style="text-align: center; flex: 1; padding: 12px;
                background: ${total_fal > 0 ? '#fdecea' : '#f8f9fa'}; border-radius: 8px;">
                <div style="font-size: 28px; font-weight: 700; color: ${total_fal > 0 ? WA_COLORS.red : '#999'};">${total_fal}</div>
                <div style="font-size: 12px; color: ${WA_COLORS.grey_text};">Total Falhados</div>
            </div>
        </div>`;

    if (historico.length > 0) {
        html += `
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
                <tr style="background: #f5f6f7;">
                    <th style="padding: 8px 12px; text-align: left; color: ${WA_COLORS.grey_text};
                        font-weight: 600; border-bottom: 2px solid #e0e0e0;">Data</th>
                    <th style="padding: 8px 12px; text-align: center; color: ${WA_COLORS.grey_text};
                        font-weight: 600; border-bottom: 2px solid #e0e0e0;">Total</th>
                    <th style="padding: 8px 12px; text-align: center; color: ${WA_COLORS.green};
                        font-weight: 600; border-bottom: 2px solid #e0e0e0;">Enviados</th>
                    <th style="padding: 8px 12px; text-align: center; color: ${WA_COLORS.red};
                        font-weight: 600; border-bottom: 2px solid #e0e0e0;">Falhados</th>
                    <th style="padding: 8px 12px; text-align: left; color: ${WA_COLORS.grey_text};
                        font-weight: 600; border-bottom: 2px solid #e0e0e0;">Por</th>
                </tr>
            </thead>
            <tbody>`;
        historico.slice().reverse().forEach(function (row) {
            html += `
            <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 8px 12px;">${frappe.datetime.str_to_user(row.data_envio_real)}</td>
                <td style="padding: 8px 12px; text-align: center;">${row.total || 0}</td>
                <td style="padding: 8px 12px; text-align: center; color: ${WA_COLORS.green};
                    font-weight: 600;">${row.enviados || 0}</td>
                <td style="padding: 8px 12px; text-align: center;
                    color: ${(row.falhados || 0) > 0 ? WA_COLORS.red : '#999'};
                    font-weight: 600;">${row.falhados || 0}</td>
                <td style="padding: 8px 12px; color: ${WA_COLORS.grey_text};">
                    ${frappe.utils.escape_html(row.disparado_por || '')}
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
    } else {
        html += `<div style="text-align: center; padding: 16px; color: ${WA_COLORS.grey_text}; font-size: 13px;">
            Nenhum envio registado ainda.</div>`;
    }

    html += '</div>';
    frm.fields_dict.resultado_html.$wrapper.html(html);
}

// ============================================================
// Falhados area
// ============================================================
function render_falhados_area(frm) {
    if (!frm.fields_dict.falhados_html) return;
    let $w = frm.fields_dict.falhados_html.$wrapper;
    $w.html(`<div style="color:${WA_COLORS.grey_text};font-size:12px;padding:8px 0;">A carregar contactos falhados...</div>`);

    frappe.call({
        method: 'whatsapp_notifications.whatsapp_notifications.doctype.aviso_whatsapp.aviso_whatsapp.get_falhados_aviso',
        args: { aviso_name: frm.doc.name },
        callback: function (r) {
            let falhados = r.message || [];
            if (!falhados.length) {
                $w.html('');
                return;
            }

            // Build rows HTML
            let rows_html = falhados.map(function (f) {
                let label = f.nome
                    ? `<span style="font-weight:600;color:#333;">${frappe.utils.escape_html(f.nome)}</span>
                       <span style="color:${WA_COLORS.grey_text};margin:0 4px;">—</span>`
                    : '';
                let erro_html = f.erro
                    ? `<span style="font-size:11px;color:#b71c1c;margin-left:8px;"
                        title="${frappe.utils.escape_html(f.erro)}">⚠ ${frappe.utils.escape_html(f.erro.substring(0, 60))}${f.erro.length > 60 ? '…' : ''}</span>`
                    : '';
                return `<div class="wa-falhado-row" style="display:flex;align-items:center;gap:4px;
                    padding:6px 10px;border-bottom:1px solid #fce4e4;flex-wrap:wrap;">
                    ${label}
                    <code style="font-size:12px;color:${WA_COLORS.teal};background:#f5f5f5;
                        padding:1px 6px;border-radius:4px;">${frappe.utils.escape_html(f.numero)}</code>
                    ${erro_html}
                </div>`;
            }).join('');

            let all_numbers = falhados.map(f => f.numero).join('\n');
            let all_with_names = falhados.map(f => f.nome ? `${f.nome} - ${f.numero}` : f.numero).join('\n');

            let html = `
            <div style="border:1px solid #ffcdd2;border-radius:10px;overflow:hidden;margin-top:4px;">
                <div style="background:#ffebee;padding:12px 16px;display:flex;align-items:center;
                    justify-content:space-between;flex-wrap:wrap;gap:8px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="font-size:18px;">❌</span>
                        <span style="font-weight:700;font-size:14px;color:#b71c1c;">
                            ${falhados.length} contacto${falhados.length !== 1 ? 's' : ''} falhado${falhados.length !== 1 ? 's' : ''}
                        </span>
                        <span style="font-size:11px;color:#c62828;">
                            (sem WhatsApp ou número inválido)
                        </span>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn-xs btn-default wa-copy-numbers"
                            style="border-color:#e57373;color:#c62828;">
                            📋 Copiar Números
                        </button>
                        <button class="btn btn-xs btn-default wa-copy-names-numbers"
                            style="border-color:#e57373;color:#c62828;">
                            📋 Copiar com Nomes
                        </button>
                    </div>
                </div>
                <div style="max-height:280px;overflow-y:auto;background:white;">
                    ${rows_html}
                </div>
            </div>`;

            $w.html(html);

            $w.find('.wa-copy-numbers').on('click', function () {
                frappe.utils.copy_to_clipboard(all_numbers);
                frappe.show_alert({ message: __(`${falhados.length} número(s) copiados`), indicator: 'green' });
            });
            $w.find('.wa-copy-names-numbers').on('click', function () {
                frappe.utils.copy_to_clipboard(all_with_names);
                frappe.show_alert({ message: __(`${falhados.length} contacto(s) copiados com nomes`), indicator: 'green' });
            });
        }
    });
}

// ============================================================
// Add fonte dialog (step 1: pick type, step 2: configure)
// ============================================================
function show_add_fonte_dialog(frm) {
    let tipo_options = [
        { tipo: 'Catecumenos', icon: '&#128106;', label: 'Catecumenos' },
        { tipo: 'Catequistas', icon: '&#127891;', label: 'Catequistas' },
        { tipo: 'Turma', icon: '&#128101;', label: 'Turma' },
        { tipo: 'Preparacao Sacramento', icon: '&#128218;', label: 'Prep. Sacramento' },
        { tipo: 'DocType', icon: '&#128203;', label: 'DocType Din\u00e2mico' },
        { tipo: 'Numeros Manuais', icon: '&#128241;', label: 'N\u00fameros Manuais' },
        { tipo: 'Grupo WhatsApp', icon: '&#128172;', label: 'Grupo WhatsApp' }
    ];

    let picker_html = `
    <div style="padding: 8px;">
        <div style="font-size: 13px; color: ${WA_COLORS.grey_text}; margin-bottom: 12px;">
            Escolha o tipo de fonte de destinat\u00e1rios:
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
            ${tipo_options.map(o => `
            <button class="wa-tipo-picker" data-tipo="${o.tipo}"
                style="display: flex; flex-direction: column; align-items: center; gap: 6px;
                padding: 14px 8px; border: 1.5px solid #e0e0e0; border-radius: 10px;
                background: white; cursor: pointer; transition: all .15s;
                font-size: 12px; font-weight: 500; color: #555;">
                <span style="font-size: 28px;">${o.icon}</span>
                ${frappe.utils.escape_html(o.label)}
            </button>`).join('')}
        </div>
    </div>`;

    let step1 = new frappe.ui.Dialog({
        title: 'Adicionar Fonte de Destinat\u00e1rios',
        fields: [{ fieldname: 'picker_html', fieldtype: 'HTML' }]
    });
    step1.fields_dict.picker_html.$wrapper.html(picker_html);
    step1.show();

    step1.fields_dict.picker_html.$wrapper.find('.wa-tipo-picker').hover(
        function () { $(this).css({ 'border-color': WA_COLORS.teal, 'background': '#f0f9f7' }); },
        function () { $(this).css({ 'border-color': '#e0e0e0', 'background': 'white' }); }
    ).on('click', function () {
        let tipo = $(this).data('tipo');
        step1.hide();
        show_configure_fonte_dialog(frm, tipo);
    });
}

// Dispatcher: route to specific dialog per type
function show_configure_fonte_dialog(frm, tipo) {
    if (tipo === 'Numeros Manuais') {
        show_manual_fonte_dialog(frm);
    } else if (tipo === 'Grupo WhatsApp') {
        show_grupo_fonte_dialog(frm);
    } else if (tipo === 'DocType') {
        show_doctype_fonte_dialog(frm);
    } else {
        // Catecumenos, Catequistas, Turma, Preparacao Sacramento
        show_catechism_picker_dialog(frm, tipo);
    }
}

// ============================================================
// Catechism picker: searchable list, "Todos" or specific record
// ============================================================
function show_catechism_picker_dialog(frm, tipo) {
    let api_tipo_map = {
        'Catecumenos': 'Catecumeno',
        'Catequistas': 'Catequista',
        'Turma': 'Turma',
        'Preparacao Sacramento': 'Preparacao do Sacramento'
    };
    let api_tipo = api_tipo_map[tipo];
    let has_status_filter = ['Catecumenos', 'Catequistas', 'Turma'].includes(tipo);
    let has_padrinhos = ['Catecumenos', 'Preparacao Sacramento'].includes(tipo);

    let status_options_map = {
        'Catecumenos': '\nActivo\nPendente\nInativo\nTransferido\nCrismado',
        'Catequistas': '\nActivo\nInactivo',
        'Turma':       '\nActivo\nInactivo'
    };

    let selected_name = null;    // null = Todos; string = specific record name
    let selected_display = null; // display label of selected record
    let all_records = [];

    let dialog_fields = [];
    if (has_status_filter) {
        dialog_fields.push({
            fieldname: 'filtro_status',
            fieldtype: 'Select',
            label: 'Filtrar por Status',
            options: status_options_map[tipo] || '\nActivo\nInactivo',
            default: 'Activo',
            description: 'Deixe vazio para incluir todos'
        });
    }
    if (has_padrinhos) {
        dialog_fields.push({
            fieldname: 'incluir_padrinhos',
            fieldtype: 'Check',
            label: 'Incluir contactos de Padrinhos'
        });
    }
    dialog_fields.push({
        fieldname: 'section_filtro_extra',
        fieldtype: 'Section Break',
        label: 'Filtros Adicionais (opcional)',
        collapsible: 1
    });
    dialog_fields.push({
        fieldname: 'filtros_html',
        fieldtype: 'HTML',
        options: '<div class="wa-filtros-builder" style="padding:4px 0;"></div>'
    });
    dialog_fields.push({ fieldname: 'preview_resultado_html', fieldtype: 'HTML' });
    dialog_fields.push({ fieldname: 'section_lista', fieldtype: 'Section Break', label: 'Seleccionar Registo' });
    dialog_fields.push({ fieldname: 'search', fieldtype: 'Data', placeholder: 'Pesquisar...' });
    dialog_fields.push({ fieldname: 'list_html', fieldtype: 'HTML' });

    let filter_builder = null;

    let dialog = new frappe.ui.Dialog({
        title: 'Seleccionar Fonte: ' + tipo,
        size: 'large',
        fields: dialog_fields,
        primary_action_label: 'Adicionar Fonte',
        primary_action: function () {
            let values = dialog.get_values() || {};
            let filtros = filter_builder ? filter_builder.get_filters() : [];
            dialog.hide();
            let fonte_data = {
                tipo_fonte: tipo,
                filtro_status: values.filtro_status || '',
                nome_registo: selected_name || '',
                incluir_padrinhos: values.incluir_padrinhos || 0,
                filtros: JSON.stringify(filtros),
                filtro_campo: '',
                filtro_operador: '=',
                filtro_valor: ''
            };
            fonte_data.descricao = build_descricao(tipo, {
                filtro_status: fonte_data.filtro_status,
                nome_registo: fonte_data.nome_registo,
                incluir_padrinhos: fonte_data.incluir_padrinhos,
                filtros: fonte_data.filtros,
                _display: selected_display
            });
            add_fonte_to_frm(frm, fonte_data);
        }
    });

    function render_list() {
        let filter_text = (dialog.get_value('search') || '').toLowerCase();
        let status_filter = has_status_filter ? (dialog.get_value('filtro_status') || '') : null;

        let filtered = all_records.filter(function (rec) {
            let match = (rec.display || '').toLowerCase().includes(filter_text) ||
                (rec.name || '').toLowerCase().includes(filter_text);
            if (!match) return false;
            if (status_filter) return (rec.status || '') === status_filter;
            return true;
        });

        let todos_sel = (selected_name === null);

        let list_html = `<div style="border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; max-height: 360px; overflow-y: auto;">`;

        // "Todos" row
        list_html += `
        <div class="wa-pick-row" data-name="" data-display=""
            style="display: flex; align-items: center; gap: 12px; padding: 11px 14px;
            border-bottom: 2px solid #e0e0e0; cursor: pointer;
            background: ${todos_sel ? '#e8f5e9' : '#fafafa'}; transition: background .1s;">
            <div style="width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
                border: 2px solid ${todos_sel ? WA_COLORS.green : '#ccc'};
                background: ${todos_sel ? WA_COLORS.green : 'white'};
                display: flex; align-items: center; justify-content: center;">
                ${todos_sel ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' : ''}
            </div>
            <div>
                <div style="font-weight: 600; font-size: 14px; color: ${todos_sel ? WA_COLORS.teal : '#333'};">
                    Todos os ${tipo}
                    ${status_filter ? `<span style="font-size: 11px; font-weight: 400;
                        color: ${WA_COLORS.grey_text};"> com status: ${frappe.utils.escape_html(status_filter)}</span>` : ''}
                </div>
                <div style="font-size: 11px; color: ${WA_COLORS.grey_text};">
                    ${filtered.length} registo(s) vis\u00edvel(is)
                </div>
            </div>
        </div>`;

        if (filtered.length === 0) {
            list_html += `<div style="padding: 20px; text-align: center; color: ${WA_COLORS.grey_text}; font-size: 13px;">
                Nenhum resultado encontrado.</div>`;
        } else {
            filtered.forEach(function (rec) {
                let is_sel = (selected_name === rec.name);
                list_html += `
                <div class="wa-pick-row" data-name="${frappe.utils.escape_html(rec.name)}"
                    data-display="${frappe.utils.escape_html(rec.display || rec.name)}"
                    style="display: flex; align-items: center; gap: 12px; padding: 9px 14px;
                    border-bottom: 1px solid #f5f5f5; cursor: pointer;
                    background: ${is_sel ? '#e8f5e9' : 'white'}; transition: background .1s;">
                    <div style="width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
                        border: 2px solid ${is_sel ? WA_COLORS.green : '#ccc'};
                        background: ${is_sel ? WA_COLORS.green : 'white'};
                        display: flex; align-items: center; justify-content: center;">
                        ${is_sel ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' : ''}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 500; font-size: 13px; white-space: nowrap;
                            overflow: hidden; text-overflow: ellipsis;
                            color: ${is_sel ? WA_COLORS.teal : '#333'};">
                            ${frappe.utils.escape_html(rec.display || rec.name)}
                            ${rec.status && !status_filter ? `<span style="font-size: 10px; padding: 1px 6px;
                                border-radius: 8px; margin-left: 5px;
                                background: ${rec.status === 'Activo' ? WA_COLORS.green : '#aaa'};
                                color: white;">${frappe.utils.escape_html(rec.status)}</span>` : ''}
                        </div>
                        ${rec.info ? `<div style="font-size: 11px; color: ${WA_COLORS.grey_text}; white-space: nowrap;
                            overflow: hidden; text-overflow: ellipsis;">${frappe.utils.escape_html(rec.info)}</div>` : ''}
                    </div>
                </div>`;
            });
        }
        list_html += '</div>';
        list_html += `
        <div style="padding: 6px 12px; font-size: 12px; border-top: 1px solid #eee; margin-top: 4px;">
            ${selected_name === null
                ? `<span style="color: ${WA_COLORS.teal}; font-weight: 500;">&#10003; Todos os ${tipo} seleccionados</span>`
                : `<span style="color: ${WA_COLORS.teal}; font-weight: 500;">&#10003; Espec\u00edfico: ${frappe.utils.escape_html(selected_display || selected_name)}</span>`
            }
        </div>`;

        dialog.fields_dict.list_html.$wrapper.html(list_html);

        dialog.fields_dict.list_html.$wrapper.find('.wa-pick-row').on('click', function () {
            let name = $(this).data('name');
            let disp = $(this).data('display');
            selected_name = name === '' ? null : name;
            selected_display = name === '' ? null : disp;
            render_list();
        }).hover(
            function () {
                let name = $(this).data('name');
                let is_active = (name === '' && selected_name === null) || name === selected_name;
                if (!is_active) $(this).css('background', '#f0f9f7');
            },
            function () {
                let name = $(this).data('name');
                let is_active = (name === '' && selected_name === null) || name === selected_name;
                $(this).css('background', is_active ? '#e8f5e9' : (name === '' ? '#fafafa' : 'white'));
            }
        );
    }

    function do_preview_filter() {
        if (!filter_builder) return;
        let filtros = filter_builder.get_filters();
        let filtro_status_val = has_status_filter ? (dialog.get_value('filtro_status') || '') : '';
        let preview_fonte = {
            tipo_fonte: tipo,
            filtro_status: filtro_status_val,
            nome_registo: selected_name || '',
            incluir_padrinhos: dialog.get_value('incluir_padrinhos') || 0,
            filtros: JSON.stringify(filtros),
        };
        dialog.fields_dict.preview_resultado_html.$wrapper.html(
            '<div style="padding:6px 0;color:' + WA_COLORS.grey_text + ';font-size:12px;">A calcular...</div>'
        );
        frappe.call({
            method: 'whatsapp_notifications.whatsapp_notifications.doctype.aviso_whatsapp.aviso_whatsapp.preview_fonte_destinatarios',
            args: { fonte_json: JSON.stringify(preview_fonte) },
            callback: function (r) {
                let recs = r.message || [];
                let html = '<div style="margin-top:6px;padding:8px 12px;background:#f0faf5;border-radius:8px;border:1px solid #c3e6cb;">';
                html += '<span style="font-weight:700;color:' + WA_COLORS.teal + ';">' + recs.length + ' destinatário(s) com este filtro</span>';
                if (recs.length > 0) {
                    html += '<div style="margin-top:4px;font-size:11px;color:#555;max-height:80px;overflow-y:auto;">';
                    html += recs.slice(0, 8).map(function (rec) {
                        return frappe.utils.escape_html((rec.nome || '') + ' · ' + rec.contacto);
                    }).join('<br>');
                    if (recs.length > 8) html += '<br><em>...e mais ' + (recs.length - 8) + '</em>';
                    html += '</div>';
                }
                html += '</div>';
                dialog.fields_dict.preview_resultado_html.$wrapper.html(html);
            }
        });
    }

    // Load records, then show dialog
    frappe.call({
        method: 'whatsapp_notifications.whatsapp_notifications.doctype.envio_whatsapp_catequese.envio_whatsapp_catequese.get_registros_para_dialogo',
        args: { doctype: api_tipo },
        freeze: true,
        freeze_message: 'Carregando ' + tipo + '...',
        callback: function (r) {
            all_records = r.message || [];
            render_list();
            dialog.fields_dict.search.$input.on('input', function () { render_list(); });
            if (has_status_filter) {
                dialog.fields_dict.filtro_status.$input.on('change', function () { render_list(); });
            }
        }
    });

    // Load all fields for the filter builder datalist
    frappe.call({
        method: 'whatsapp_notifications.whatsapp_notifications.doctype.aviso_whatsapp.aviso_whatsapp.get_doctype_all_fields',
        args: { doctype: api_tipo },
        callback: function (r) {
            if (r.message && r.message.length) {
                if (filter_builder) filter_builder.set_fields(r.message);
            }
        }
    });

    let _preview_timer = null;
    function _debounce_preview() {
        clearTimeout(_preview_timer);
        _preview_timer = setTimeout(do_preview_filter, 600);
    }

    dialog.show();

    setTimeout(function() {
        let init_filters = [];
        filter_builder = _wa_init_filter_builder(
            dialog.$wrapper.find('.wa-filtros-builder'),
            init_filters,
            _debounce_preview
        );
    }, 100);

    setTimeout(function () {
        if (dialog.fields_dict.search) dialog.fields_dict.search.$input.focus();
    }, 300);
}

// ============================================================
// DocType dynamic fonte dialog — Link field for DocType name
// ============================================================
function show_doctype_fonte_dialog(frm) {
    let dialog = new frappe.ui.Dialog({
        title: 'Fonte DocType Din\u00e2mico',
        size: 'large',
        fields: [
            {
                fieldname: 'doctype_fonte',
                fieldtype: 'Link',
                options: 'DocType',
                label: 'DocType',
                reqd: 1,
                description: 'Pesquise e seleccione qualquer DocType do sistema'
            },
            {
                fieldname: 'col_break_main',
                fieldtype: 'Column Break'
            },
            {
                fieldname: 'campo_contacto',
                fieldtype: 'Select',
                label: 'Campo de Contacto (telefone)',
                reqd: 1,
                options: '',
                description: 'Seleccione ap\u00f3s escolher o DocType'
            },
            {
                fieldname: 'section_child',
                fieldtype: 'Section Break',
                label: 'Contactos numa Child Table',
                collapsible: 1
            },
            {
                fieldname: 'usar_child_table',
                fieldtype: 'Check',
                label: 'Os contactos est\u00e3o numa child table'
            },
            {
                fieldname: 'child_table_field',
                fieldtype: 'Select',
                label: 'Campo da Child Table',
                options: '',
                depends_on: 'eval:doc.usar_child_table==1'
            },
            {
                fieldname: 'campo_contacto_child',
                fieldtype: 'Select',
                label: 'Campo Contacto (na child table)',
                options: '',
                depends_on: 'eval:doc.usar_child_table==1'
            },
            {
                fieldname: 'section_filter',
                fieldtype: 'Section Break',
                label: 'Filtros (opcional)',
                collapsible: 1
            },
            {
                fieldname: 'filtros_html',
                fieldtype: 'HTML',
                options: '<div class="wa-filtros-builder" style="padding:4px 0;"></div>'
            },
            {
                fieldname: 'preview_resultado_html',
                fieldtype: 'HTML'
            }
        ],
        primary_action_label: 'Adicionar Fonte',
        primary_action: function () {
            let values = dialog.get_values();
            if (!values || !values.doctype_fonte) {
                frappe.msgprint('Seleccione o DocType.');
                return;
            }
            let contact_field = values.usar_child_table ? values.campo_contacto_child : values.campo_contacto;
            if (!contact_field) {
                frappe.msgprint('Seleccione o campo de contacto.');
                return;
            }
            dialog.hide();
            let filtros = dt_filter_builder ? dt_filter_builder.get_filters() : [];
            add_fonte_to_frm(frm, {
                tipo_fonte: 'DocType',
                doctype_fonte: values.doctype_fonte,
                campo_contacto: values.campo_contacto || '',
                usar_child_table: values.usar_child_table || 0,
                child_table_field: values.child_table_field || '',
                campo_contacto_child: values.campo_contacto_child || '',
                filtros: JSON.stringify(filtros),
                filtro_campo: '',
                filtro_operador: '=',
                filtro_valor: '',
                descricao: build_descricao('DocType', Object.assign({}, values, {
                    filtros: JSON.stringify(filtros)
                }))
            });
        }
    });

    let dt_filter_builder = null;

    function do_dt_preview_filter() {
        let dt = dialog.get_value('doctype_fonte');
        if (!dt) return;
        let contact_field = dialog.get_value('usar_child_table')
            ? dialog.get_value('campo_contacto_child')
            : dialog.get_value('campo_contacto');
        if (!contact_field) {
            dialog.fields_dict.preview_resultado_html.$wrapper.html('');
            return;
        }
        let filtros = dt_filter_builder ? dt_filter_builder.get_filters() : [];
        let preview_fonte = {
            tipo_fonte: 'DocType',
            doctype_fonte: dt,
            campo_contacto: contact_field,
            usar_child_table: dialog.get_value('usar_child_table') || 0,
            child_table_field: dialog.get_value('child_table_field') || '',
            campo_contacto_child: contact_field,
            filtros: JSON.stringify(filtros)
        };
        dialog.fields_dict.preview_resultado_html.$wrapper.html(
            '<div style="padding:6px 0;color:' + WA_COLORS.grey_text + ';font-size:12px;">A calcular...</div>'
        );
        frappe.call({
            method: 'whatsapp_notifications.whatsapp_notifications.doctype.aviso_whatsapp.aviso_whatsapp.preview_fonte_destinatarios',
            args: { fonte_json: JSON.stringify(preview_fonte) },
            callback: function (r) {
                let recs = r.message || [];
                let html = '<div style="margin-top:6px;padding:8px 12px;background:#f0faf5;border-radius:8px;border:1px solid #c3e6cb;">';
                html += '<span style="font-weight:700;color:' + WA_COLORS.teal + ';">' + recs.length + ' destinatário(s) com este filtro</span>';
                if (recs.length > 0) {
                    html += '<div style="margin-top:4px;font-size:11px;color:#555;max-height:80px;overflow-y:auto;">';
                    html += recs.slice(0, 8).map(function (rec) {
                        return frappe.utils.escape_html((rec.nome || '') + ' · ' + rec.contacto);
                    }).join('<br>');
                    if (recs.length > 8) html += '<br><em>...e mais ' + (recs.length - 8) + '</em>';
                    html += '</div>';
                }
                html += '</div>';
                dialog.fields_dict.preview_resultado_html.$wrapper.html(html);
            }
        });
    }

    function load_fields_for_doctype(dt) {
        if (!dt) return;
        frappe.show_alert({ message: 'Carregando campos de ' + dt + '...', indicator: 'blue' }, 2);
        frappe.call({
            method: 'whatsapp_notifications.whatsapp_notifications.doctype.aviso_whatsapp.aviso_whatsapp.get_doctype_phone_fields',
            args: { doctype: dt },
            callback: function (r) {
                if (r.message && r.message.length) {
                    let opts_plain = '\n' + r.message.map(f => f.fieldname).join('\n');
                    dialog.fields_dict.campo_contacto.df.options = opts_plain;
                    dialog.fields_dict.campo_contacto.refresh();
                    dialog.fields_dict.campo_contacto_child.df.options = opts_plain;
                    dialog.fields_dict.campo_contacto_child.refresh();
                    frappe.show_alert({
                        message: r.message.length + ' campo(s) de telefone encontrado(s)',
                        indicator: 'green'
                    }, 3);
                } else {
                    dialog.fields_dict.campo_contacto.df.options = '';
                    dialog.fields_dict.campo_contacto.refresh();
                    frappe.show_alert({ message: 'Nenhum campo de telefone encontrado', indicator: 'orange' }, 4);
                }
            }
        });
        frappe.call({
            method: 'whatsapp_notifications.whatsapp_notifications.doctype.aviso_whatsapp.aviso_whatsapp.get_doctype_child_tables',
            args: { doctype: dt },
            callback: function (r) {
                if (r.message && r.message.length) {
                    let opts = '\n' + r.message.map(f => f.fieldname).join('\n');
                    dialog.fields_dict.child_table_field.df.options = opts;
                    dialog.fields_dict.child_table_field.refresh();
                }
            }
        });
        frappe.call({
            method: 'whatsapp_notifications.whatsapp_notifications.doctype.aviso_whatsapp.aviso_whatsapp.get_doctype_all_fields',
            args: { doctype: dt },
            callback: function (r) {
                if (r.message && r.message.length) {
                    if (dt_filter_builder) dt_filter_builder.set_fields(r.message);
                }
            }
        });
    }

    let _dt_preview_timer = null;
    function _dt_debounce_preview() {
        clearTimeout(_dt_preview_timer);
        _dt_preview_timer = setTimeout(do_dt_preview_filter, 600);
    }

    // React to Link field selection (awesomplete) or manual entry (blur)
    dialog.fields_dict.doctype_fonte.$input.on('awesomplete-selectcomplete', function () {
        setTimeout(function () {
            let dt = dialog.get_value('doctype_fonte');
            if (dt) load_fields_for_doctype(dt);
        }, 100);
    });
    dialog.fields_dict.doctype_fonte.$input.on('blur', function () {
        let dt = dialog.get_value('doctype_fonte');
        if (dt) load_fields_for_doctype(dt);
    });

    dialog.show();

    setTimeout(function() {
        dt_filter_builder = _wa_init_filter_builder(
            dialog.$wrapper.find('.wa-filtros-builder'),
            [],
            _dt_debounce_preview
        );
    }, 100);
}

// ============================================================
// Manual numbers dialog — Mozambican format placeholder
// ============================================================
function show_manual_fonte_dialog(frm) {
    let dialog = new frappe.ui.Dialog({
        title: 'Adicionar N\u00fameros Manuais',
        fields: [
            {
                fieldname: 'numeros',
                fieldtype: 'Small Text',
                label: 'N\u00fameros de Telefone',
                reqd: 1,
                description: 'Um n\u00famero por linha. Pode incluir um nome opcional ap\u00f3s o n\u00famero (ex: <code>840123456 Jo\u00e3o</code>). O c\u00f3digo 258 \u00e9 adicionado automaticamente.'
            },
            {
                fieldname: 'hint_html',
                fieldtype: 'HTML'
            }
        ],
        primary_action_label: 'Adicionar',
        primary_action: function (values) {
            if (!values.numeros || !values.numeros.trim()) return;
            dialog.hide();
            let lines = values.numeros.split('\n').filter(l => l.trim());
            let named = lines.filter(function(l) {
                let t = l.trim();
                if (t.includes('\t')) return true;
                if (t.includes(' - ')) return true;
                let ci = t.indexOf(',');
                if (ci >= 0 && /[a-zA-Z\u00C0-\u00FF]/.test(t.slice(ci + 1))) return true;
                let p = t.split(/\s+/);
                return p.length >= 2 && /^[\d+]{7,}$/.test(p[0].replace(/[+]/g,'')) && /[a-zA-Z\u00C0-\u00FF]/.test(p.slice(1).join(' '));
            }).length;
            let descricao = lines.length + ' n\u00famero(s) manual(is)';
            if (named > 0) descricao += ', ' + named + ' com nome';
            add_fonte_to_frm(frm, {
                tipo_fonte: 'Numeros Manuais',
                numeros: values.numeros,
                descricao: descricao
            });
        }
    });

    dialog.fields_dict.hint_html.$wrapper.html(`
    <div style="padding: 8px 0; font-size: 12px; color: ${WA_COLORS.grey_text};">
        <strong>Formatos suportados:</strong>
        <div style="font-family: monospace; background: #f5f6f7; border-radius: 6px;
            padding: 8px 12px; margin-top: 6px; line-height: 1.8;">
            840000000<br>
            860000001 Maria<br>
            870000002 - Jo\u00e3o<br>
            880000003,Ana
        </div>
        <div style="margin-top: 6px;">
            O nome \u00e9 <strong>opcional</strong>. Se fornecido, fica dispon\u00edvel como <code>{{ number_owner }}</code> na mensagem.<br>
            O c\u00f3digo <strong>258</strong> \u00e9 adicionado automaticamente.
        </div>
    </div>`);

    // Set placeholder via DOM after show
    dialog.show();
    setTimeout(function () {
        dialog.fields_dict.numeros.$input &&
            dialog.fields_dict.numeros.$input.attr('placeholder', '840123456\n860123456 Maria\n870123456 - Jo\u00e3o');
    }, 100);
}

// ============================================================
// WhatsApp group picker — live groups from Evolution API
// ============================================================
function show_grupo_fonte_dialog(frm) {
    frappe.call({
        method: 'whatsapp_notifications.whatsapp_notifications.api.fetch_whatsapp_groups',
        freeze: true,
        freeze_message: 'Carregando grupos WhatsApp...',
        callback: function(r) {
            if (!r.message || !r.message.success) {
                frappe.msgprint({
                    title: 'Erro',
                    indicator: 'red',
                    message: (r.message && r.message.error) || 'Não foi possível carregar os grupos WhatsApp.'
                });
                return;
            }
            let groups = r.message.groups || [];
            let selected = new Set();

            let dialog = new frappe.ui.Dialog({
                title: 'Seleccionar Grupos WhatsApp',
                size: 'large',
                fields: [
                    { fieldname: 'search', fieldtype: 'Data', placeholder: 'Pesquisar grupo...' },
                    { fieldname: 'list_html', fieldtype: 'HTML' }
                ],
                primary_action_label: 'Adicionar Grupos Seleccionados',
                primary_action: function() {
                    if (selected.size === 0) { frappe.msgprint('Seleccione pelo menos um grupo.'); return; }
                    dialog.hide();
                    groups.filter(function(g) { return selected.has(g.id); }).forEach(function(g) {
                        add_fonte_to_frm(frm, {
                            tipo_fonte: 'Grupo WhatsApp',
                            grupo_id: g.id,
                            grupo_nome: g.subject || g.id,
                            descricao: (g.subject || g.id) + (g.size ? ' (' + g.size + ' membros)' : '')
                        });
                    });
                }
            });

            function render_list(filter_text) {
                filter_text = (filter_text || '').toLowerCase();
                let filtered = groups.filter(function(g) {
                    return (g.subject || '').toLowerCase().includes(filter_text) ||
                           (g.id || '').toLowerCase().includes(filter_text);
                });
                let list_html = `<div style="border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;max-height:340px;overflow-y:auto;">`;
                if (filtered.length === 0) {
                    list_html += `<div style="padding:24px;text-align:center;color:${WA_COLORS.grey_text};font-size:13px;">
                        Nenhum grupo encontrado.</div>`;
                } else {
                    filtered.forEach(function(g) {
                        let checked = selected.has(g.id);
                        list_html += `
                        <div class="wa-select-row" data-id="${frappe.utils.escape_html(g.id)}"
                            style="display:flex;align-items:center;gap:12px;padding:10px 14px;
                            border-bottom:1px solid #f0f0f0;cursor:pointer;
                            background:${checked ? '#e8f5e9' : 'white'};transition:background .1s;">
                            <div style="width:20px;height:20px;border-radius:4px;flex-shrink:0;
                                border:2px solid ${checked ? WA_COLORS.green : '#ccc'};
                                background:${checked ? WA_COLORS.green : 'white'};
                                display:flex;align-items:center;justify-content:center;">
                                ${checked ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' : ''}
                            </div>
                            <div style="width:36px;height:36px;border-radius:50%;background:${WA_COLORS.dark_green};
                                flex-shrink:0;display:flex;align-items:center;justify-content:center;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                                </svg>
                            </div>
                            <div style="flex:1;min-width:0;">
                                <div style="font-weight:500;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                    ${frappe.utils.escape_html(g.subject || g.id)}
                                </div>
                                <div style="font-size:11px;color:${WA_COLORS.grey_text};">
                                    ${g.size ? g.size + ' membros' : 'Grupo'}
                                </div>
                            </div>
                        </div>`;
                    });
                }
                list_html += '</div>';
                list_html += `<div style="padding:6px 12px;font-size:12px;color:${WA_COLORS.grey_text};border-top:1px solid #eee;margin-top:4px;">
                    ${selected.size > 0
                        ? `<span style="color:${WA_COLORS.teal};font-weight:500;">&#10003; ${selected.size} grupo(s) seleccionado(s)</span>`
                        : 'Nenhum grupo seleccionado'}
                </div>`;
                dialog.fields_dict.list_html.$wrapper.html(list_html);
                dialog.fields_dict.list_html.$wrapper.find('.wa-select-row').on('click', function() {
                    let id = $(this).data('id');
                    if (selected.has(id)) { selected.delete(id); } else { selected.add(id); }
                    render_list(dialog.get_value('search'));
                }).hover(
                    function() { if (!selected.has($(this).data('id'))) $(this).css('background', '#f0f9f7'); },
                    function() { if (!selected.has($(this).data('id'))) $(this).css('background', 'white'); }
                );
            }

            render_list('');
            dialog.fields_dict.search.$input.on('input', function() { render_list($(this).val()); });
            dialog.show();
            setTimeout(function() { dialog.fields_dict.search.$input.focus(); }, 200);
        }
    });
}

function _build_filtro_descricao(values) {
    let filtros = [];
    try { filtros = JSON.parse(values.filtros || '[]'); } catch(e) { filtros = []; }
    // Backward compat: fall back to old single filter fields
    if (!filtros.length) {
        let campo = (values.filtro_campo || '').split(' \u2014 ')[0].trim();
        if (campo) filtros = [{ campo: campo, operador: values.filtro_operador || '=', valor: values.filtro_valor || '' }];
    }
    if (!filtros.length) return '';
    let parts = filtros.map(function(f) {
        if (['is set', 'is not set'].includes(f.operador)) return '[' + f.campo + ' ' + f.operador + ']';
        return f.valor ? '[' + f.campo + ' ' + f.operador + ' ' + f.valor + ']' : '[' + f.campo + ']';
    });
    return ' ' + parts.join(' & ');
}

function build_descricao(tipo, values) {
    let display = values._display; // optional resolved display name
    if (tipo === 'Catecumenos') {
        let parts = [];
        if (values.filtro_status) parts.push(values.filtro_status);
        parts.push(display || values.nome_registo || 'Todos');
        if (values.incluir_padrinhos) parts.push('+ Padrinhos');
        let base = parts.join(' \u00b7 ');
        return base + _build_filtro_descricao(values);
    }
    if (tipo === 'Catequistas') {
        let parts = [];
        if (values.filtro_status) parts.push(values.filtro_status);
        parts.push(display || values.nome_registo || 'Todos');
        return parts.join(' \u00b7 ') + _build_filtro_descricao(values);
    }
    if (tipo === 'Turma') {
        let s = display || values.nome_registo;
        let base = s ? 'Turma: ' + s : 'Todas as Turmas';
        return base + _build_filtro_descricao(values);
    }
    if (tipo === 'Preparacao Sacramento') {
        let s = display || values.nome_registo || 'Todas';
        if (values.incluir_padrinhos) s += ' + Padrinhos';
        return s + _build_filtro_descricao(values);
    }
    if (tipo === 'DocType') {
        let base = (values.doctype_fonte || '?') + ' \u2192 ' + (values.campo_contacto || values.campo_contacto_child || '?');
        return base + _build_filtro_descricao(values);
    }
    if (tipo === 'Numeros Manuais') {
        let lines = (values.numeros || '').split('\n').filter(l => l.trim());
        let named = lines.filter(function(l) {
            let t = l.trim();
            if (t.includes('\t')) return true;
            if (t.includes(' - ')) return true;
            let ci = t.indexOf(',');
            if (ci >= 0 && /[a-zA-Z\u00C0-\u00FF]/.test(t.slice(ci + 1))) return true;
            let p = t.split(/\s+/);
            return p.length >= 2 && /^[\d+]{7,}$/.test(p[0].replace(/[+]/g,'')) && /[a-zA-Z\u00C0-\u00FF]/.test(p.slice(1).join(' '));
        }).length;
        let label = lines.length + ' n\u00famero(s)';
        if (named > 0) label += ', ' + named + ' com nome';
        return label;
    }
    return tipo;
}

function add_fonte_to_frm(frm, fonte_data) {
    // Use frappe.model.add_child so the row is registered in frappe.model.locals
    // and frm.save() can properly serialize it.
    let row = frappe.model.add_child(frm.doc, 'Aviso WhatsApp Fonte', 'fontes');
    let frappe_keys = new Set(['doctype', 'name', 'idx', 'parenttype', 'parentfield', 'parent', '__islocal', '__unsaved']);
    Object.entries(fonte_data).forEach(function ([k, v]) {
        if (!frappe_keys.has(k)) row[k] = v;
    });
    frm.dirty();
    frm.refresh_field('fontes');
    render_destinatarios_area(frm);
    frappe.show_alert({ message: __('Fonte adicionada.'), indicator: 'green' }, 3);
}

// ============================================================
// Template help panel
// ============================================================
function show_template_help() {
    let dialog = new frappe.ui.Dialog({
        title: 'Vari\u00e1veis Dispon\u00edveis no Template',
        fields: [{
            fieldname: 'help_html',
            fieldtype: 'HTML'
        }]
    });
    dialog.fields_dict.help_html.$wrapper.html(`
    <div style="font-family: monospace; font-size: 13px; line-height: 1.8; padding: 8px;">
        <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #f5f6f7;">
                <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #e0e0e0;">Vari\u00e1vel</th>
                <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #e0e0e0;">Descri\u00e7\u00e3o</th>
            </tr>
            <tr><td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0;"><code>{{ nome }}</code></td>
                <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0;">Nome do destinat\u00e1rio</td></tr>
            <tr><td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0;"><code>{{ contacto }}</code></td>
                <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0;">N\u00famero de telefone</td></tr>
            <tr><td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0;"><code>{{ origem }}</code></td>
                <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0;">Fonte do destinat\u00e1rio</td></tr>
            <tr><td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0;"><code>{{ doc.campo }}</code></td>
                <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0;">Campo do documento de origem</td></tr>
            <tr><td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0;"><code>{% if nome %}...{% endif %}</code></td>
                <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0;">Condi\u00e7\u00e3o</td></tr>
        </table>
        <div style="margin-top: 12px; padding: 10px; background: #e8f5e9; border-radius: 6px; font-size: 12px;">
            <strong>Exemplo:</strong><br>
            <code>Ol\u00e1 {{ nome }},\nJunto enviamos informa\u00e7\u00e3o importante para si.</code>
        </div>
    </div>`);
    dialog.show();
}

// ============================================================
// Send actions
// ============================================================
function do_enviar_agora(frm) {
    let fontes_count = (frm.doc.fontes || []).length;
    if (fontes_count === 0) {
        frappe.msgprint('Adicione pelo menos uma fonte de destinat\u00e1rios.');
        return;
    }
    if (!frm.doc.mensagem && !frm.doc.anexo) {
        frappe.msgprint('Escreva a mensagem ou anexe um ficheiro.');
        return;
    }

    frappe.confirm(
        `<div style="text-align: center;">
            <div style="font-size: 40px; margin-bottom: 8px;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="${WA_COLORS.green}">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
            </div>
            <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">
                Enviar Aviso WhatsApp?
            </div>
            <div style="color: ${WA_COLORS.grey_text};">
                ${fontes_count} fonte(s) configurada(s). Os destinat\u00e1rios ser\u00e3o resolvidos agora.
            </div>
        </div>`,
        function () {
            let do_send = function () {
                frappe.call({
                    method: 'enviar_agora',
                    doc: frm.doc,
                    freeze: true,
                    freeze_message: 'Enviando mensagens WhatsApp... Aguarde.',
                    callback: function (r) {
                        frm.reload_doc();
                        if (r.message && r.message.queued) {
                            frappe.show_alert({
                                message: __('Envio iniciado em segundo plano. O estado será atualizado quando terminar.'),
                                indicator: 'blue'
                            }, 8);
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

function do_agendar(frm) {
    if (!(frm.doc.fontes || []).length) {
        frappe.msgprint('Adicione pelo menos uma fonte de destinat\u00e1rios.');
        return;
    }
    if (!frm.doc.mensagem && !frm.doc.anexo) {
        frappe.msgprint('Escreva a mensagem ou anexe um ficheiro.');
        return;
    }
    if (!frm.doc.data_envio) {
        frappe.msgprint('Indique a data e hora de envio.');
        return;
    }

    let do_schedule = function () {
        frappe.call({
            method: 'agendar',
            doc: frm.doc,
            freeze: true,
            freeze_message: 'Agendando aviso...',
            callback: function (r) {
                if (r.message) {
                    frm.reload_doc();
                    frappe.show_alert({
                        message: __('Aviso agendado para {0}.', [frappe.datetime.str_to_user(r.message.proximo_envio)]),
                        indicator: 'green'
                    }, 7);
                }
            }
        });
    };

    if (frm.is_dirty()) {
        frm.save().then(do_schedule);
    } else {
        do_schedule();
    }
}

// ============================================================
// List view
// ============================================================
frappe.listview_settings['Aviso WhatsApp'] = {
    get_indicator: function (doc) {
        let colors = {
            'Rascunho': 'orange', 'Agendado': 'blue', 'Enviando': 'blue',
            'Enviado': 'green', 'Recorrente': 'purple', 'Pausado': 'yellow',
            'Conclu\u00eddo': 'green'
        };
        return [doc.status, colors[doc.status] || 'grey', 'status,=,' + doc.status];
    },
    add_fields: ['status', 'titulo']
};

// ─────────────────────────────────────────────────────────────────────
// Table Helper — guard: may already be defined by conversa_whatsapp.js
// ─────────────────────────────────────────────────────────────────────
frappe.whatsapp = frappe.whatsapp || {};

if (!frappe.whatsapp.open_table_helper) {
    frappe.whatsapp.open_table_helper = function() {
        let d = new frappe.ui.Dialog({
            title: __('Auxiliar de Tabela WhatsApp'),
            size: 'large',
            fields: [{
                fieldtype: 'HTML',
                fieldname: 'table_helper_html',
                options: `
<div style="padding: 4px 0;">
    <div style="margin-bottom: 12px;">
        <label style="font-size: 13px; font-weight: 500; color: #333; display: block; margin-bottom: 6px;">
            Cole os seus dados <span style="font-weight:400; color:#888;">(TSV, CSV ou separado por |)</span>
        </label>
        <textarea class="wa-th-input form-control" rows="6"
            placeholder="Nome&#9;Idade&#9;Cidade&#10;Jo&#227;o&#9;25&#9;Lisboa&#10;Maria&#9;30&#9;Porto"
            style="font-family: monospace; font-size: 13px; resize: vertical; width: 100%;"></textarea>
    </div>
    <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 12px;">
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; margin: 0;">
            <input type="checkbox" class="wa-th-header" style="cursor: pointer; width: 14px; height: 14px;">
            Primeira linha &#233; cabe&#231;alho
        </label>
        <button class="btn btn-sm btn-primary wa-th-generate">Gerar Tabela</button>
    </div>
    <div style="margin-bottom: 8px;">
        <label style="font-size: 13px; font-weight: 500; color: #333; display: block; margin-bottom: 6px;">
            Resultado:
        </label>
        <textarea class="wa-th-output form-control" rows="8" readonly
            style="font-family: monospace; font-size: 12px; background: #f8f9fa; resize: vertical; width: 100%;"></textarea>
    </div>
    <div style="text-align: right;">
        <button class="btn btn-sm btn-default wa-th-copy" style="min-width: 150px;">
            Copiar para &#193;rea de Transfer&#234;ncia
        </button>
    </div>
</div>`
            }]
        });

        d.show();
        let $w = d.$wrapper;

        $w.find('.wa-th-generate').on('click', function() {
            let raw = $w.find('.wa-th-input').val();
            let has_header = $w.find('.wa-th-header').is(':checked');
            if (!raw.trim()) {
                frappe.show_alert({ message: __('Cole os dados primeiro.'), indicator: 'orange' }, 3);
                return;
            }
            $w.find('.wa-th-output').val(_wa_build_table(raw, has_header));
        });

        $w.find('.wa-th-copy').on('click', function() {
            let text = $w.find('.wa-th-output').val();
            if (!text) {
                frappe.show_alert({ message: __('Gere a tabela primeiro.'), indicator: 'orange' }, 3);
                return;
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => {
                    frappe.show_alert({ message: __('Copiado!'), indicator: 'green' }, 2);
                });
            } else {
                $w.find('.wa-th-output')[0].select();
                document.execCommand('copy');
                frappe.show_alert({ message: __('Copiado!'), indicator: 'green' }, 2);
            }
        });
    };

}

function _wa_build_table(raw, has_header) {
    let lines = raw.split('\n');
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    if (!lines.length) return '';
    let sep = '\t';
    let sample = lines[0];
    if (sample.indexOf('\t') === -1) {
        if (sample.indexOf(',') !== -1) sep = ',';
        else if (sample.indexOf('|') !== -1) sep = '|';
        else sep = null;
    }
    let rows = lines.map(line => {
        if (!sep) return [line.trim()];
        if (sep === ',') return _wa_parse_csv_line(line);
        return line.split(sep).map(c => c.trim());
    });
    let max_cols = Math.max(...rows.map(r => r.length));
    rows = rows.map(r => { while (r.length < max_cols) r.push(''); return r; });
    let col_widths = Array(max_cols).fill(0);
    rows.forEach(row => row.forEach((cell, i) => {
        col_widths[i] = Math.max(col_widths[i], cell.length);
    }));
    let out = [];
    rows.forEach((row, idx) => {
        out.push(row.map((cell, i) => cell.padEnd(col_widths[i])).join(' | '));
        if (has_header && idx === 0) {
            out.push(col_widths.map(w => '-'.repeat(w)).join('-+-'));
        }
    });
    return '```\n' + out.join('\n') + '\n```';
}

function _wa_parse_csv_line(line) {
    let result = [], current = '', in_quotes = false;
    for (let i = 0; i < line.length; i++) {
        let ch = line[i];
        if (ch === '"') {
            if (in_quotes && line[i + 1] === '"') { current += '"'; i++; }
            else { in_quotes = !in_quotes; }
        } else if (ch === ',' && !in_quotes) {
            result.push(current.trim()); current = '';
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

function _wa_prefix_lines($ta, prefix_fn) {
    let el = $ta[0];
    if (!el) return;
    let val = el.value;
    let ss = el.selectionStart, se = el.selectionEnd;
    let ls = val.lastIndexOf('\n', ss - 1) + 1;
    let le = val.indexOf('\n', se);
    if (le === -1) le = val.length;
    let lines = val.substring(ls, le).split('\n');
    let new_block = lines.map((line, i) => prefix_fn(i) + line).join('\n');
    el.value = val.substring(0, ls) + new_block + val.substring(le);
    $ta.trigger('input').trigger('change');
    el.focus();
}

function _wa_open_emoji_picker($anchor, $ta) {
    $('.wa-emoji-picker-pop').remove();
    const EMOJIS = [
        '😀','😂','😊','😍','🥰','😘','😎','😇','🤔','😅','😆','😁',
        '🙏','👍','👎','❤️','🔥','✨','🎉','🎊','🎁','🎂','🎈','🌟',
        '💯','👏','🤝','💪','🙌','🌹','🌷','🌸','🌺','🍀','🌙','⭐',
        '🌈','🌞','⚡','💫','🎵','🎶','📱','💻','📷','🏠','🚀','✈️',
        '🚗','⛪','📖','✝️','🕊️','💝','💖','💗','💓','💞','💕',
        '🙂','😉','🥹','😢','😭','😤','🤗','🥳','😴','🤩','🫶','🫂',
    ];
    let $picker = $('<div class="wa-emoji-picker-pop"></div>').css({
        position: 'fixed', background: '#fff', border: '1px solid #e0e0e0',
        borderRadius: '10px', padding: '8px',
        display: 'grid', gridTemplateColumns: 'repeat(9, 30px)', gap: '2px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.18)', zIndex: 10000,
        maxHeight: '200px', overflowY: 'auto',
    });
    EMOJIS.forEach(emoji => {
        let $e = $(`<button style="width:28px;height:28px;border:none;background:none;
            cursor:pointer;font-size:18px;padding:0;border-radius:4px;">${emoji}</button>`);
        $e.on('mouseenter', () => $e.css('background', '#f0f0f0'));
        $e.on('mouseleave', () => $e.css('background', 'none'));
        $e.on('click', function(ev) {
            ev.stopPropagation();
            let el = $ta[0], val = el.value, pos = el.selectionStart;
            el.value = val.substring(0, pos) + emoji + val.substring(el.selectionEnd);
            let new_pos = pos + [...emoji].length;
            el.selectionStart = el.selectionEnd = new_pos;
            $ta.trigger('input').trigger('change');
            el.focus();
            $picker.remove();
        });
        $picker.append($e);
    });
    $('body').append($picker);
    let rect = $anchor[0].getBoundingClientRect();
    let top = rect.top - 220;
    if (top < 8) top = rect.bottom + 4;
    let left = Math.min(rect.left, window.innerWidth - 300);
    $picker.css({ top, left });
    setTimeout(() => $(document).one('click.wa_emoji', () => $picker.remove()), 10);
}

// ─────────────────────────────────────────────────────────────────────
// Multi-filter builder widget
// ─────────────────────────────────────────────────────────────────────
function _wa_init_filter_builder($container, initial_filters, on_change) {
    const OPS = ['=', '!=', 'is set', 'is not set', 'like', 'not like', '>', '<'];
    let _fields = [];

    function _op_html(sel) {
        return '<select class="wa-fb-op form-control" style="flex:0 0 130px;width:130px;">' +
            OPS.map(op => `<option value="${op}"${op === sel ? ' selected' : ''}>${op}</option>`).join('') +
            '</select>';
    }

    function _add_row(campo, operador, valor) {
        let uid = 'wafb' + Date.now() + Math.floor(Math.random() * 9999);
        let no_val = ['is set', 'is not set'].includes(operador);
        let $row = $(`
        <div class="wa-fb-row" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
            <input type="text" class="wa-fb-campo form-control"
                style="flex:3;min-width:0;" list="${uid}" placeholder="Campo..."
                value="${frappe.utils.escape_html(campo || '')}">
            <datalist id="${uid}"></datalist>
            ${_op_html(operador || '=')}
            <input type="text" class="wa-fb-val form-control"
                style="flex:3;min-width:0;" placeholder="Valor..."
                value="${frappe.utils.escape_html(valor || '')}"
                ${no_val ? 'disabled' : ''}>
            <button class="wa-fb-rem btn btn-default" style="flex-shrink:0;color:#c62828;
                border-color:#ddd;padding:5px 10px;font-size:15px;line-height:1;">×</button>
        </div>`);

        // Populate datalist with available fields
        let $dl = $row.find('datalist');
        _fields.forEach(f => $dl.append(`<option value="${f.fieldname}">${f.label || f.fieldname}</option>`));

        $row.find('.wa-fb-op').on('change', function() {
            let no_v = ['is set', 'is not set'].includes($(this).val());
            $row.find('.wa-fb-val').prop('disabled', no_v).val(no_v ? '' : $row.find('.wa-fb-val').val());
            if (on_change) on_change();
        });
        $row.find('.wa-fb-rem').on('click', function(e) { e.preventDefault(); $row.remove(); if (on_change) on_change(); });
        $row.find('.wa-fb-campo').on('change blur', function() { if (on_change) on_change(); });
        $row.find('.wa-fb-val').on('input change blur', function() { if (on_change) on_change(); });

        $container.find('.wa-fb-rows').append($row);
    }

    $container.html(`
        <div class="wa-fb-rows"></div>
        <button class="wa-fb-add btn btn-xs btn-default" style="margin-top:4px;font-size:11px;">
            + Adicionar filtro
        </button>`);

    $container.find('.wa-fb-add').on('click', function(e) {
        e.preventDefault();
        _add_row('', '=', '');
    });

    (initial_filters || []).forEach(f => _add_row(f.campo, f.operador, f.valor));

    return {
        get_filters: function() {
            let out = [];
            $container.find('.wa-fb-row').each(function() {
                let campo = $(this).find('.wa-fb-campo').val().trim();
                if (!campo) return;
                out.push({
                    campo: campo,
                    operador: $(this).find('.wa-fb-op').val() || '=',
                    valor: $(this).find('.wa-fb-val').val().trim()
                });
            });
            return out;
        },
        set_fields: function(fields) {
            _fields = fields;
            $container.find('.wa-fb-row').each(function() {
                let $dl = $(this).find('datalist');
                $dl.empty();
                fields.forEach(f => $dl.append(`<option value="${f.fieldname}">${f.label || f.fieldname}</option>`));
            });
        }
    };
}
