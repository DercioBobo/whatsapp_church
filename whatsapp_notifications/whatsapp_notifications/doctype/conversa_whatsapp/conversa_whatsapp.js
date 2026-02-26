// Conversa WhatsApp — Full Chat UI

const WA_C = {
    green:       '#25D366',
    dark_green:  '#128C7E',
    teal:        '#075E54',
    bg_chat:     '#efeae2',
    bubble_out:  '#d9fdd3',
    text_main:   '#111b21',
    text_meta:   '#667781',
    check_blue:  '#53bdeb',
    check_warn:  '#f0a500',
    compose_bg:  '#f0f2f5',
    border:      'rgba(0,0,0,0.08)',
};

// ─────────────────────────────────────────────────────────────────────
// Form event
// ─────────────────────────────────────────────────────────────────────
frappe.ui.form.on('Conversa WhatsApp', {
    refresh(frm) {
        // Hide raw data fields — everything is rendered via chat_html
        ['primeiro_envio', 'ultimo_envio', 'fontes', 'historico'].forEach(f => {
            frm.set_df_property(f, 'hidden', 1);
        });

        // Status indicator in page header
        const badges = { 'Ativa': 'green', 'Arquivada': 'grey' };
        frm.page.set_indicator(frm.doc.status || 'Ativa', badges[frm.doc.status] || 'green');

        // Archive / Reactivate button
        if (!frm.is_new()) {
            if (frm.doc.status === 'Ativa') {
                frm.add_custom_button(__('Arquivar'), () => {
                    frappe.confirm(__('Arquivar esta conversa?'), () => {
                        frm.call('arquivar').then(() => frm.reload_doc());
                    });
                });
            } else {
                frm.add_custom_button(__('Reativar'), () => {
                    frm.call('reativar').then(() => frm.reload_doc());
                });
            }

            _inject_css();
            _render_conversa(frm);
        }
    },
});

// ─────────────────────────────────────────────────────────────────────
// CSS injection (once per page load)
// ─────────────────────────────────────────────────────────────────────
let _css_injected = false;

function _inject_css() {
    if (_css_injected) return;
    _css_injected = true;

    const css = `
    /* ── Container ────────────────────────────────────────── */
    .wa-chat-container {
        display: flex;
        flex-direction: column;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.13);
        background: ${WA_C.bg_chat};
        min-height: 520px;
        max-height: calc(100vh - 210px);
        margin-top: 4px;
    }

    /* ── Recipients header ─────────────────────────────────── */
    .wa-header {
        background: ${WA_C.teal};
        padding: 10px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
        user-select: none;
    }
    .wa-header-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: rgba(255,255,255,0.18);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        flex-shrink: 0;
    }
    .wa-header-info { flex: 1; min-width: 0; }
    .wa-header-title {
        font-size: 16px;
        font-weight: 600;
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.3;
    }
    .wa-header-sub {
        font-size: 12px;
        color: rgba(255,255,255,0.72);
        margin-top: 1px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .wa-header-btn {
        background: rgba(255,255,255,0.16);
        border: none;
        border-radius: 8px;
        color: #fff;
        font-size: 12px;
        padding: 6px 12px;
        cursor: pointer;
        flex-shrink: 0;
        transition: background 0.15s;
        display: flex;
        align-items: center;
        gap: 5px;
    }
    .wa-header-btn:hover { background: rgba(255,255,255,0.28); }

    /* ── Messages area ─────────────────────────────────────── */
    .wa-messages {
        flex: 1;
        overflow-y: auto;
        padding: 14px 18px 10px;
        display: flex;
        flex-direction: column;
        gap: 3px;
        scroll-behavior: smooth;
    }
    .wa-messages::-webkit-scrollbar { width: 5px; }
    .wa-messages::-webkit-scrollbar-track { background: transparent; }
    .wa-messages::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.18); border-radius: 10px; }

    /* ── Empty state ───────────────────────────────────────── */
    .wa-empty {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: ${WA_C.text_meta};
        gap: 10px;
        padding: 40px 20px;
        text-align: center;
    }
    .wa-empty-icon { font-size: 52px; opacity: 0.45; }
    .wa-empty-title { font-size: 15px; font-weight: 500; color: #444; }
    .wa-empty-sub { font-size: 12px; max-width: 280px; }

    /* ── Date separator ────────────────────────────────────── */
    .wa-date-sep {
        display: flex;
        justify-content: center;
        margin: 10px 0 5px;
        pointer-events: none;
    }
    .wa-date-sep span {
        background: rgba(255,255,255,0.84);
        border-radius: 8px;
        padding: 4px 13px;
        font-size: 12px;
        color: ${WA_C.text_meta};
        box-shadow: 0 1px 2px rgba(0,0,0,0.10);
        font-weight: 500;
    }

    /* ── Bubble ────────────────────────────────────────────── */
    .wa-bubble-wrap {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 2px;
    }
    .wa-bubble {
        max-width: 68%;
        background: ${WA_C.bubble_out};
        border-radius: 12px 12px 2px 12px;
        padding: 7px 10px 5px 10px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.10);
        word-break: break-word;
    }
    .wa-bubble-attach {
        display: flex;
        align-items: center;
        gap: 7px;
        font-size: 13px;
        color: ${WA_C.dark_green};
        background: rgba(0,0,0,0.05);
        border-radius: 8px;
        padding: 7px 10px;
        margin-bottom: 5px;
        font-weight: 500;
    }
    .wa-bubble-text {
        font-size: 14.5px;
        line-height: 1.52;
        color: ${WA_C.text_main};
        white-space: pre-wrap;
    }
    .wa-bubble-meta {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 5px;
        margin-top: 4px;
        flex-wrap: nowrap;
    }
    .wa-bubble-stats {
        font-size: 11px;
        color: ${WA_C.text_meta};
        white-space: nowrap;
    }
    .wa-bubble-stats.warn { color: ${WA_C.check_warn}; }
    .wa-bubble-time {
        font-size: 11px;
        color: ${WA_C.text_meta};
        white-space: nowrap;
    }
    .wa-checks { display: inline-flex; align-items: center; flex-shrink: 0; }

    /* ── Compose bar ───────────────────────────────────────── */
    .wa-compose {
        background: ${WA_C.compose_bg};
        padding: 8px 12px;
        display: flex;
        align-items: flex-end;
        gap: 8px;
        border-top: 1px solid ${WA_C.border};
        flex-shrink: 0;
    }
    .wa-compose-archived {
        flex: 1;
        text-align: center;
        font-size: 13px;
        color: ${WA_C.text_meta};
        padding: 10px;
    }
    .wa-icon-btn {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        border: none;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: ${WA_C.text_meta};
        flex-shrink: 0;
        transition: color 0.15s, background 0.15s;
        padding: 0;
    }
    .wa-icon-btn:hover { color: ${WA_C.dark_green}; background: rgba(0,0,0,0.05); }
    .wa-input-wrap {
        flex: 1;
        background: #fff;
        border-radius: 22px;
        padding: 9px 15px 7px;
        display: flex;
        flex-direction: column;
        gap: 5px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        min-width: 0;
    }
    .wa-textarea {
        border: none;
        outline: none;
        resize: none;
        font-size: 14.5px;
        line-height: 1.5;
        background: transparent;
        font-family: inherit;
        color: ${WA_C.text_main};
        overflow-y: hidden;
        width: 100%;
        min-height: 22px;
        max-height: 130px;
    }
    .wa-textarea::placeholder { color: ${WA_C.text_meta}; }
    .wa-attach-preview {
        display: flex;
        align-items: center;
        gap: 7px;
        background: #e8f5e9;
        border-radius: 8px;
        padding: 5px 10px;
        font-size: 12px;
        color: ${WA_C.dark_green};
    }
    .wa-attach-preview-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 500;
    }
    .wa-attach-remove {
        cursor: pointer;
        color: #c62828;
        font-size: 16px;
        line-height: 1;
        padding: 0 2px;
        flex-shrink: 0;
    }
    .wa-template-row {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        color: ${WA_C.text_meta};
        cursor: pointer;
        user-select: none;
    }
    .wa-template-row input[type=checkbox] { cursor: pointer; margin: 0; }
    .wa-send-btn {
        width: 46px;
        height: 46px;
        border-radius: 50%;
        border: none;
        background: ${WA_C.green};
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background 0.15s, transform 0.1s;
        box-shadow: 0 3px 8px rgba(37,211,102,0.38);
        padding: 0;
    }
    .wa-send-btn:hover { background: ${WA_C.dark_green}; transform: scale(1.05); }
    .wa-send-btn:disabled { background: #bdbdbd; box-shadow: none; transform: none; cursor: not-allowed; }
    .wa-send-btn svg { fill: #fff; }

    /* ── Fontes manager ─────────────────────────────────────── */
    .wa-fonte-list { display: flex; flex-direction: column; gap: 6px; }
    .wa-fonte-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 12px;
        border-radius: 10px;
        background: #f5f6f8;
        border: 1px solid #eaeaea;
    }
    .wa-fonte-badge {
        font-size: 10px;
        font-weight: 600;
        background: ${WA_C.teal};
        color: #fff;
        border-radius: 20px;
        padding: 3px 9px;
        white-space: nowrap;
        flex-shrink: 0;
        letter-spacing: 0.3px;
    }
    .wa-fonte-desc {
        flex: 1;
        font-size: 13px;
        color: ${WA_C.text_main};
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .wa-fonte-del {
        border: none;
        background: none;
        color: #e53935;
        cursor: pointer;
        font-size: 17px;
        line-height: 1;
        padding: 2px 4px;
        border-radius: 4px;
        flex-shrink: 0;
        transition: background 0.12s;
    }
    .wa-fonte-del:hover { background: #fde8e8; }
    .wa-no-fontes {
        text-align: center;
        color: ${WA_C.text_meta};
        font-size: 13px;
        padding: 20px;
        border: 2px dashed #e0e0e0;
        border-radius: 10px;
    }
    `;

    $('<style id="wa-conversa-css">').text(css).appendTo('head');
}

// ─────────────────────────────────────────────────────────────────────
// Main render
// ─────────────────────────────────────────────────────────────────────
function _render_conversa(frm) {
    let $w = frm.fields_dict.chat_html.$wrapper;
    $w.empty();

    let $c = $('<div class="wa-chat-container"></div>');
    $c.append(_build_header(frm));
    $c.append(_build_messages(frm));
    $c.append(_build_compose(frm));
    $w.append($c);

    // Auto-scroll to bottom after render
    setTimeout(() => {
        let $msgs = $c.find('.wa-messages');
        if ($msgs.length) $msgs.scrollTop($msgs[0].scrollHeight);
    }, 80);
}

// ─────────────────────────────────────────────────────────────────────
// Header: recipients summary
// ─────────────────────────────────────────────────────────────────────
function _build_header(frm) {
    let fontes  = frm.doc.fontes || [];
    let locked  = !!frm.doc.primeiro_envio;

    let sub = fontes.length === 0
        ? 'Sem destinatários — configure antes de enviar'
        : fontes.map(f => f.descricao || f.tipo_fonte).join('  ·  ');

    let $hdr = $(`
        <div class="wa-header">
            <div class="wa-header-avatar">👥</div>
            <div class="wa-header-info">
                <div class="wa-header-title">${frappe.utils.escape_html(frm.doc.titulo || '')}</div>
                <div class="wa-header-sub">${frappe.utils.escape_html(sub)}</div>
            </div>
        </div>
    `);

    // Show edit button only if fontes not yet locked (or there are none)
    if (!locked || fontes.length === 0) {
        let $btn = $(`<button class="wa-header-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
            Destinatários
        </button>`);
        $btn.on('click', () => _open_fontes_manager(frm));
        $hdr.append($btn);
    }

    return $hdr;
}

// ─────────────────────────────────────────────────────────────────────
// Messages
// ─────────────────────────────────────────────────────────────────────
function _build_messages(frm) {
    let $area     = $('<div class="wa-messages"></div>');
    let historico = frm.doc.historico || [];

    if (historico.length === 0) {
        $area.append(`
            <div class="wa-empty">
                <div class="wa-empty-icon">💬</div>
                <div class="wa-empty-title">Nenhuma mensagem ainda</div>
                <div class="wa-empty-sub">Configure os destinatários e comece a conversa.</div>
            </div>
        `);
        return $area;
    }

    let last_day = null;
    historico.forEach(h => {
        let day = h.data_envio ? h.data_envio.substring(0, 10) : '';
        if (day && day !== last_day) {
            last_day = day;
            $area.append(_build_date_sep(h.data_envio));
        }
        $area.append(_build_bubble(h));
    });

    return $area;
}

function _build_date_sep(datetime_str) {
    return $(`<div class="wa-date-sep"><span>${_fmt_day(datetime_str)}</span></div>`);
}

function _build_bubble(h) {
    let $wrap   = $('<div class="wa-bubble-wrap"></div>');
    let $bubble = $('<div class="wa-bubble"></div>');

    // Attachment row
    if (h.tem_anexo) {
        $bubble.append(`
            <div class="wa-bubble-attach">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="${WA_C.dark_green}">
                    <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
                </svg>
                Ficheiro enviado
            </div>
        `);
    }

    // Message text
    let msg = h.mensagem || '';
    if (msg) {
        $bubble.append($('<div class="wa-bubble-text"></div>').text(msg));
    }

    // Meta footer
    let has_warn  = (h.falhados || 0) > 0;
    let chk_color = has_warn ? WA_C.check_warn : WA_C.check_blue;
    let stats_cls = has_warn ? 'wa-bubble-stats warn' : 'wa-bubble-stats';
    let stats_txt = has_warn
        ? `${h.enviados}✓  ${h.falhados}✗`
        : `${h.enviados}/${h.total}`;

    $bubble.append(`
        <div class="wa-bubble-meta">
            <span class="${stats_cls}">${stats_txt}</span>
            <span class="wa-bubble-time">${_fmt_time(h.data_envio)}</span>
            <svg class="wa-checks" width="18" height="11" viewBox="0 0 18 11">
                <polyline points="1,5 5,9 11,1" fill="none" stroke="${chk_color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="5,5 9,9 17,1" fill="none" stroke="${chk_color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
    `);

    $wrap.append($bubble);
    return $wrap;
}

// ─────────────────────────────────────────────────────────────────────
// Compose bar
// ─────────────────────────────────────────────────────────────────────
function _build_compose(frm) {
    let $bar = $('<div class="wa-compose"></div>');

    if (frm.doc.status === 'Arquivada') {
        $bar.append(`<div class="wa-compose-archived">🔒 Conversa arquivada. Reative para enviar mensagens.</div>`);
        return $bar;
    }

    // State
    let _attachment    = null;
    let _usar_template = false;

    // ── Attachment button
    let $attach_btn = $(`
        <button class="wa-icon-btn" title="Anexar ficheiro">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
            </svg>
        </button>
    `);

    $attach_btn.on('click', () => {
        let d = new frappe.ui.Dialog({
            title: __('Anexar Ficheiro'),
            fields: [{ fieldname: 'ficheiro', fieldtype: 'Attach', label: __('Ficheiro'), reqd: 1 }],
            primary_action_label: __('Confirmar'),
            primary_action(vals) {
                if (vals.ficheiro) {
                    let parts = vals.ficheiro.split('/');
                    _attachment = { file_url: vals.ficheiro, file_name: parts[parts.length - 1] };
                    $preview_name.text(_attachment.file_name);
                    $preview.show();
                }
                d.hide();
            },
        });
        d.show();
    });

    // ── Input wrap
    let $input_wrap = $('<div class="wa-input-wrap"></div>');

    // Attachment preview (hidden by default)
    let $preview = $('<div class="wa-attach-preview" style="display:none;"></div>');
    let $preview_name = $('<span class="wa-attach-preview-name"></span>');
    let $preview_rm   = $('<span class="wa-attach-remove" title="Remover">✕</span>');
    $preview_rm.on('click', () => { _attachment = null; $preview.hide(); });
    $preview.append(
        $('<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>'),
        $preview_name,
        $preview_rm
    );
    $input_wrap.append($preview);

    // Textarea (auto-grow)
    let $ta = $('<textarea class="wa-textarea" rows="1" placeholder="Escreva uma mensagem…"></textarea>');
    $ta.on('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 130) + 'px';
    });
    $input_wrap.append($ta);

    // Template toggle
    let $tpl_row  = $('<label class="wa-template-row"></label>');
    let $tpl_cb   = $('<input type="checkbox">');
    $tpl_cb.on('change', function () { _usar_template = this.checked; });
    $tpl_row.append($tpl_cb, document.createTextNode(' Usar template {{nome}}'));
    $input_wrap.append($tpl_row);

    // ── Send button
    let $send = $(`
        <button class="wa-send-btn" title="Enviar  (Ctrl + Enter)">
            <svg width="21" height="21" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
        </button>
    `);

    function do_send() {
        let msg = $ta.val().trim();
        if (!msg && !_attachment) {
            frappe.show_alert({ message: 'Escreva uma mensagem ou anexe um ficheiro.', indicator: 'orange' }, 3);
            return;
        }
        if (!frm.doc.fontes || frm.doc.fontes.length === 0) {
            frappe.show_alert({ message: 'Configure os destinatários primeiro (⚙ Destinatários).', indicator: 'orange' }, 4);
            return;
        }
        if (frm.is_dirty()) {
            frappe.show_alert({ message: 'Guarde o documento antes de enviar.', indicator: 'orange' }, 3);
            return;
        }

        $send.prop('disabled', true);

        frm.call({
            doc:             frm.doc,
            method:          'enviar',
            args: {
                mensagem:      msg,
                usar_template: _usar_template ? 1 : 0,
                anexo:         _attachment ? _attachment.file_url : null,
            },
            freeze:          true,
            freeze_message:  __('A enviar mensagem…'),
            callback(r) {
                $send.prop('disabled', false);
                if (r.message && r.message.success) {
                    $ta.val('').trigger('input');
                    _attachment = null;
                    $preview.hide();
                    $tpl_cb.prop('checked', false);
                    _usar_template = false;
                    let m = r.message;
                    frappe.show_alert({
                        message:   `Enviado para ${m.enviados} de ${m.total}` + (m.falhados > 0 ? ` (${m.falhados} falhas)` : ''),
                        indicator: m.falhados > 0 ? 'orange' : 'green',
                    }, 5);
                    frm.reload_doc();
                } else {
                    frappe.msgprint({
                        title:     __('Erro no envio'),
                        indicator: 'red',
                        message:   (r.message && r.message.error) || __('Falha ao enviar.'),
                    });
                }
            },
        });
    }

    $send.on('click', do_send);
    $ta.on('keydown', e => { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); do_send(); } });

    $bar.append($attach_btn, $input_wrap, $send);
    return $bar;
}

// ─────────────────────────────────────────────────────────────────────
// Fontes manager dialog
// ─────────────────────────────────────────────────────────────────────
function _open_fontes_manager(frm) {
    let d = new frappe.ui.Dialog({
        title: __('Destinatários da Conversa'),
        size:  'large',
        fields: [
            { fieldname: 'list_html', fieldtype: 'HTML' },
            {
                fieldname: 'sec_add',
                fieldtype: 'Section Break',
                label:     __('Adicionar nova fonte'),
                collapsible: 0,
            },
            {
                fieldname: 'tipo_fonte',
                fieldtype: 'Select',
                label:     __('Tipo de Fonte'),
                options:   'Catecumenos\nCatequistas\nTurma\nPreparacao Sacramento\nDocType\nNumeros Manuais\nGrupo WhatsApp',
            },
        ],
        primary_action_label: __('Guardar'),
        primary_action() {
            d.hide();
            _save_fontes(frm);
        },
    });

    function refresh_list() {
        let fontes = frm.doc.fontes || [];
        let $list = $('<div class="wa-fonte-list"></div>');

        if (fontes.length === 0) {
            $list.append('<div class="wa-no-fontes">Nenhuma fonte configurada. Adicione uma abaixo.</div>');
        } else {
            fontes.forEach((f, idx) => {
                let $row = $(`
                    <div class="wa-fonte-row">
                        <span class="wa-fonte-badge">${frappe.utils.escape_html(f.tipo_fonte || '')}</span>
                        <span class="wa-fonte-desc">${frappe.utils.escape_html(f.descricao || f.tipo_fonte || '')}</span>
                        <button class="wa-fonte-del" title="Remover">✕</button>
                    </div>
                `);
                $row.find('.wa-fonte-del').on('click', () => {
                    frm.doc.fontes.splice(idx, 1);
                    refresh_list();
                });
                $list.append($row);
            });
        }

        d.fields_dict.list_html.$wrapper.empty().append($list);
    }

    refresh_list();

    // "Adicionar" button
    let $add = $(`<button class="btn btn-sm btn-default" style="margin-top:8px;">
        + ${__('Adicionar Fonte')}
    </button>`);
    $add.on('click', () => {
        let tipo = d.get_value('tipo_fonte');
        if (!tipo) {
            frappe.show_alert({ message: 'Seleccione o tipo de fonte.', indicator: 'orange' }, 3);
            return;
        }
        d.hide();
        _show_fonte_dialog(frm, tipo, () => { d.show(); refresh_list(); });
    });

    // Inject the button after the select field
    setTimeout(() => {
        d.fields_dict.tipo_fonte.$wrapper.closest('.frappe-control').after($add);
    }, 80);

    d.show();
}

function _show_fonte_dialog(frm, tipo, on_done) {
    let fields = [];

    if (tipo === 'Catecumenos') {
        fields = [
            { fieldname: 'nome_registo',      fieldtype: 'Link',   options: 'Catecumeno',   label: __('Catecúmeno (vazio = todos)') },
            { fieldname: 'filtro_status',     fieldtype: 'Select', label: __('Filtro Status'),
              options: '\nActivo\nPendente\nInativo\nTransferido\nCrismado' },
            { fieldname: 'incluir_padrinhos', fieldtype: 'Check',  label: __('Incluir Padrinhos') },
        ];
    } else if (tipo === 'Catequistas') {
        fields = [
            { fieldname: 'nome_registo',  fieldtype: 'Link',   options: 'Catequista', label: __('Catequista (vazio = todos)') },
            { fieldname: 'filtro_status', fieldtype: 'Select', label: __('Filtro Status'), options: '\nActivo\nInactivo' },
        ];
    } else if (tipo === 'Turma') {
        fields = [
            { fieldname: 'nome_registo',  fieldtype: 'Link', options: 'Turma', label: __('Turma (vazio = todas)') },
            { fieldname: 'filtro_status', fieldtype: 'Data', label: __('Filtro Status (ex: Activa)') },
        ];
    } else if (tipo === 'Preparacao Sacramento') {
        fields = [
            { fieldname: 'nome_registo',      fieldtype: 'Link',  options: 'Preparacao do Sacramento', label: __('Preparação (vazio = todas)') },
            { fieldname: 'incluir_padrinhos', fieldtype: 'Check', label: __('Incluir Padrinhos') },
        ];
    } else if (tipo === 'DocType') {
        fields = [
            { fieldname: 'doctype_fonte',  fieldtype: 'Data', label: __('DocType'),          reqd: 1 },
            { fieldname: 'campo_contacto', fieldtype: 'Data', label: __('Campo Contacto'),   reqd: 1 },
            { fieldname: 'filtro_campo',   fieldtype: 'Data', label: __('Campo de Filtro') },
            { fieldname: 'filtro_valor',   fieldtype: 'Data', label: __('Valor de Filtro') },
        ];
    } else if (tipo === 'Numeros Manuais') {
        fields = [
            {
                fieldname:   'numeros',
                fieldtype:   'Small Text',
                label:       __('Números'),
                reqd:        1,
                description: __('Um número por linha. Ex: 840123456 | 840123456 Nome | 840123456 - Nome'),
            },
        ];
    } else if (tipo === 'Grupo WhatsApp') {
        fields = [
            { fieldname: 'grupo_id',   fieldtype: 'Data', label: __('ID do Grupo (JID)'), reqd: 1,
              description: 'ex: 120363...@g.us' },
            { fieldname: 'grupo_nome', fieldtype: 'Data', label: __('Nome do Grupo') },
        ];
    }

    let sub = new frappe.ui.Dialog({
        title:               __('Adicionar Fonte: ') + tipo,
        fields:              fields,
        primary_action_label: __('Adicionar'),
        primary_action(vals) {
            let data = Object.assign({ tipo_fonte: tipo }, vals);
            data.descricao = _build_descricao(tipo, vals);
            _add_fonte(frm, data);
            sub.hide();
            if (on_done) on_done();
        },
        secondary_action_label: __('Cancelar'),
        secondary_action() { sub.hide(); if (on_done) on_done(); },
    });

    sub.show();
}

function _build_descricao(tipo, v) {
    if (tipo === 'Catecumenos') {
        let p = [];
        if (v.filtro_status) p.push(v.filtro_status);
        p.push(v.nome_registo || 'Todos');
        if (v.incluir_padrinhos) p.push('+ Padrinhos');
        return p.join(' · ');
    }
    if (tipo === 'Catequistas') {
        let p = [];
        if (v.filtro_status) p.push(v.filtro_status);
        p.push(v.nome_registo || 'Todos');
        return p.join(' · ');
    }
    if (tipo === 'Turma') {
        return v.nome_registo ? 'Turma: ' + v.nome_registo : 'Todas as Turmas';
    }
    if (tipo === 'Preparacao Sacramento') {
        let s = v.nome_registo || 'Todas';
        if (v.incluir_padrinhos) s += ' + Padrinhos';
        return s;
    }
    if (tipo === 'DocType') {
        let b = (v.doctype_fonte || '?') + ' → ' + (v.campo_contacto || '?');
        if (v.filtro_campo && v.filtro_valor) b += ' [' + v.filtro_campo + '=' + v.filtro_valor + ']';
        return b;
    }
    if (tipo === 'Numeros Manuais') {
        let lines = (v.numeros || '').split('\n').filter(l => l.trim());
        return lines.length + ' número(s)';
    }
    if (tipo === 'Grupo WhatsApp') {
        return v.grupo_nome || v.grupo_id || 'Grupo';
    }
    return tipo;
}

function _add_fonte(frm, data) {
    if (!frm.doc.fontes) frm.doc.fontes = [];
    let row = frappe.model.add_child(frm.doc, 'Aviso WhatsApp Fonte', 'fontes');
    Object.assign(row, data);
    frm.refresh_field('fontes');
}

function _save_fontes(frm) {
    frm.save().then(() => frm.reload_doc());
}

// ─────────────────────────────────────────────────────────────────────
// Date / time helpers
// ─────────────────────────────────────────────────────────────────────
function _fmt_day(datetime_str) {
    if (!datetime_str) return '';
    // frappe stores datetimes in UTC; convert to local
    let dt = frappe.datetime.str_to_obj(datetime_str);
    let today = new Date();
    let yest  = new Date(today); yest.setDate(today.getDate() - 1);
    if (dt.toDateString() === today.toDateString()) return 'Hoje';
    if (dt.toDateString() === yest.toDateString())  return 'Ontem';
    return dt.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
}

function _fmt_time(datetime_str) {
    if (!datetime_str) return '';
    let dt = frappe.datetime.str_to_obj(datetime_str);
    return dt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}
