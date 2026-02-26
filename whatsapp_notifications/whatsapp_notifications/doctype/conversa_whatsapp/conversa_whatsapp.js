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
// Fontes manager — modern card list + tipo picker grid
// ─────────────────────────────────────────────────────────────────────
function _open_fontes_manager(frm) {
    let d = new frappe.ui.Dialog({
        title: 'Destinatários da Conversa',
        size:  'large',
        fields: [{ fieldname: 'body_html', fieldtype: 'HTML' }],
        primary_action_label: 'Guardar e Fechar',
        primary_action() { d.hide(); _save_fontes(frm); },
    });

    function refresh() {
        let fontes = frm.doc.fontes || [];
        let list_html = '';

        if (fontes.length === 0) {
            list_html = `
            <div style="text-align:center;padding:28px 16px;border:2px dashed #e0e0e0;
                border-radius:12px;color:${WA_C.text_meta};font-size:13px;margin-bottom:12px;">
                <div style="font-size:36px;margin-bottom:8px;opacity:.5;">📋</div>
                <div style="font-weight:500;color:#555;margin-bottom:4px;">Nenhuma fonte configurada</div>
                <div>Adicione destinatários clicando no botão abaixo.</div>
            </div>`;
        } else {
            list_html = `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">`;
            fontes.forEach((f, idx) => {
                let icon_map = {
                    'Catecumenos': '👶', 'Catequistas': '🎓', 'Turma': '👥',
                    'Preparacao Sacramento': '📖', 'DocType': '📋',
                    'Numeros Manuais': '📱', 'Grupo WhatsApp': '💬'
                };
                let icon = icon_map[f.tipo_fonte] || '📌';
                list_html += `
                <div class="wa-fm-row" data-idx="${idx}" style="display:flex;align-items:center;
                    gap:12px;padding:11px 14px;border-radius:10px;background:#f8f9fa;
                    border:1px solid #eaeaea;transition:background .12s;">
                    <span style="font-size:20px;flex-shrink:0;">${icon}</span>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:11px;font-weight:600;color:${WA_C.teal};
                            text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">
                            ${frappe.utils.escape_html(f.tipo_fonte || '')}
                        </div>
                        <div style="font-size:13px;color:${WA_C.text_main};white-space:nowrap;
                            overflow:hidden;text-overflow:ellipsis;">
                            ${frappe.utils.escape_html(f.descricao || f.tipo_fonte || '')}
                        </div>
                    </div>
                    <button class="wa-fm-del" data-idx="${idx}" title="Remover"
                        style="border:none;background:none;color:#e53935;cursor:pointer;
                        font-size:18px;line-height:1;padding:4px 6px;border-radius:6px;
                        flex-shrink:0;transition:background .12s;">✕</button>
                </div>`;
            });
            list_html += '</div>';
        }

        let add_btn_html = `
        <button class="wa-fm-add-btn" style="width:100%;padding:11px;border-radius:10px;
            border:1.5px dashed ${WA_C.dark_green};background:transparent;color:${WA_C.dark_green};
            font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;
            justify-content:center;gap:8px;transition:background .15s;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Adicionar Fonte de Destinatários
        </button>`;

        d.fields_dict.body_html.$wrapper.html(list_html + add_btn_html);

        // Delete handlers
        d.fields_dict.body_html.$wrapper.find('.wa-fm-del').on('click', function () {
            let idx = parseInt($(this).data('idx'));
            frm.doc.fontes.splice(idx, 1);
            refresh();
        });

        // Hover effect on add button
        let $add = d.fields_dict.body_html.$wrapper.find('.wa-fm-add-btn');
        $add.hover(
            function () { $(this).css('background', '#e8f5e9'); },
            function () { $(this).css('background', 'transparent'); }
        );

        // Add button click → tipo picker
        $add.on('click', () => {
            d.hide();
            _show_tipo_picker(frm, () => { d.show(); refresh(); });
        });

        // Row hover
        d.fields_dict.body_html.$wrapper.find('.wa-fm-row').hover(
            function () { $(this).css('background', '#f0f9f7'); },
            function () { $(this).css('background', '#f8f9fa'); }
        );
    }

    refresh();
    d.show();
}

// ─────────────────────────────────────────────────────────────────────
// Step 1: tipo picker grid (same visual as Avisos)
// ─────────────────────────────────────────────────────────────────────
function _show_tipo_picker(frm, on_done) {
    let tipos = [
        { tipo: 'Catecumenos',         icon: '👶', label: 'Catecúmenos' },
        { tipo: 'Catequistas',         icon: '🎓', label: 'Catequistas' },
        { tipo: 'Turma',               icon: '👥', label: 'Turma' },
        { tipo: 'Preparacao Sacramento', icon: '📖', label: 'Prep. Sacramento' },
        { tipo: 'DocType',             icon: '📋', label: 'DocType Dinâmico' },
        { tipo: 'Numeros Manuais',     icon: '📱', label: 'Números Manuais' },
        { tipo: 'Grupo WhatsApp',      icon: '💬', label: 'Grupo WhatsApp' },
    ];

    let picker_html = `
    <div style="padding:6px 2px;">
        <div style="font-size:13px;color:${WA_C.text_meta};margin-bottom:14px;">
            Escolha o tipo de destinatários a adicionar:
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
            ${tipos.map(o => `
            <button class="wa-tipo-btn" data-tipo="${o.tipo}"
                style="display:flex;flex-direction:column;align-items:center;gap:8px;
                padding:16px 8px;border:1.5px solid #e0e0e0;border-radius:12px;
                background:white;cursor:pointer;transition:all .15s;
                font-size:12px;font-weight:600;color:#555;letter-spacing:.2px;">
                <span style="font-size:30px;">${o.icon}</span>
                ${frappe.utils.escape_html(o.label)}
            </button>`).join('')}
        </div>
    </div>`;

    let d = new frappe.ui.Dialog({
        title: 'Adicionar Fonte de Destinatários',
        fields: [{ fieldname: 'picker_html', fieldtype: 'HTML' }],
    });

    d.fields_dict.picker_html.$wrapper.html(picker_html);
    d.show();

    d.fields_dict.picker_html.$wrapper.find('.wa-tipo-btn')
        .hover(
            function () { $(this).css({ 'border-color': WA_C.teal, 'background': '#f0f9f7', 'color': WA_C.teal }); },
            function () { $(this).css({ 'border-color': '#e0e0e0', 'background': 'white', 'color': '#555' }); }
        )
        .on('click', function () {
            let tipo = $(this).data('tipo');
            d.hide();
            _show_fonte_for_tipo(frm, tipo, on_done);
        });
}

// ─────────────────────────────────────────────────────────────────────
// Step 2: per-tipo dialogs
// ─────────────────────────────────────────────────────────────────────
function _show_fonte_for_tipo(frm, tipo, on_done) {
    if (['Catecumenos','Catequistas','Turma','Preparacao Sacramento'].includes(tipo)) {
        _show_catechism_picker(frm, tipo, on_done);
    } else if (tipo === 'DocType') {
        _show_doctype_dialog(frm, on_done);
    } else if (tipo === 'Numeros Manuais') {
        _show_manual_dialog(frm, on_done);
    } else if (tipo === 'Grupo WhatsApp') {
        _show_grupo_dialog(frm, on_done);
    }
}

// ── Catechism picker: searchable list with radio-select ──────────────
function _show_catechism_picker(frm, tipo, on_done) {
    let doctype_map = {
        'Catecumenos': 'Catecumeno',
        'Catequistas': 'Catequista',
        'Turma':       'Turma',
        'Preparacao Sacramento': 'Preparacao do Sacramento'
    };
    let status_opts = {
        'Catecumenos': '\nActivo\nPendente\nInativo\nTransferido\nCrismado',
        'Catequistas': '\nActivo\nInactivo',
        'Turma':       '\nActivo\nInactivo'
    };
    let has_status   = ['Catecumenos','Catequistas','Turma'].includes(tipo);
    let has_padrinho = ['Catecumenos','Preparacao Sacramento'].includes(tipo);

    let fields = [];
    if (has_status)   fields.push({ fieldname: 'filtro_status', fieldtype: 'Select',
        label: 'Filtrar por Status', options: status_opts[tipo], default: 'Activo',
        description: 'Deixe vazio para incluir todos' });
    if (has_padrinho) fields.push({ fieldname: 'incluir_padrinhos', fieldtype: 'Check',
        label: 'Incluir contactos de Padrinhos' });
    fields.push({ fieldname: 'search',    fieldtype: 'Data', placeholder: 'Pesquisar…' });
    fields.push({ fieldname: 'list_html', fieldtype: 'HTML' });

    let all_records   = [];
    let selected_name = null;
    let selected_disp = null;

    let d = new frappe.ui.Dialog({
        title: 'Seleccionar Fonte: ' + tipo,
        size:  'large',
        fields: fields,
        primary_action_label: 'Adicionar Fonte',
        primary_action() {
            let vals = d.get_values() || {};
            d.hide();
            let data = {
                tipo_fonte:        tipo,
                filtro_status:     vals.filtro_status || '',
                nome_registo:      selected_name || '',
                incluir_padrinhos: vals.incluir_padrinhos || 0,
            };
            data.descricao = _build_descricao(tipo, {
                filtro_status:     data.filtro_status,
                nome_registo:      data.nome_registo,
                incluir_padrinhos: data.incluir_padrinhos,
                _display:          selected_disp,
            });
            _add_fonte(frm, data);
            if (on_done) on_done();
        },
    });

    function render_list() {
        let filter_txt    = (d.get_value('search') || '').toLowerCase();
        let status_filter = has_status ? (d.get_value('filtro_status') || '') : null;

        let filtered = all_records.filter(r => {
            let match = (r.display || '').toLowerCase().includes(filter_txt) ||
                        (r.name   || '').toLowerCase().includes(filter_txt);
            if (!match) return false;
            if (status_filter) return (r.status || '') === status_filter;
            return true;
        });

        let todos_sel = (selected_name === null);
        let html = `<div style="border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;max-height:340px;overflow-y:auto;">`;

        // "Todos" row
        html += `
        <div class="wa-pick-row" data-name="" data-display=""
            style="display:flex;align-items:center;gap:12px;padding:12px 14px;
            border-bottom:2px solid #e0e0e0;cursor:pointer;
            background:${todos_sel ? '#e8f5e9' : '#fafafa'};transition:background .1s;">
            <div style="width:20px;height:20px;border-radius:50%;flex-shrink:0;
                border:2px solid ${todos_sel ? WA_C.green : '#ccc'};
                background:${todos_sel ? WA_C.green : 'white'};
                display:flex;align-items:center;justify-content:center;">
                ${todos_sel ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' : ''}
            </div>
            <div>
                <div style="font-weight:600;font-size:14px;color:${todos_sel ? WA_C.teal : '#333'};">
                    Todos os ${tipo}
                    ${status_filter ? `<span style="font-size:11px;font-weight:400;color:${WA_C.text_meta};">
                        · status: ${frappe.utils.escape_html(status_filter)}</span>` : ''}
                </div>
                <div style="font-size:11px;color:${WA_C.text_meta};">${filtered.length} registo(s) visível(is)</div>
            </div>
        </div>`;

        if (filtered.length === 0) {
            html += `<div style="padding:20px;text-align:center;color:${WA_C.text_meta};font-size:13px;">
                Nenhum resultado encontrado.</div>`;
        } else {
            filtered.forEach(rec => {
                let sel = (selected_name === rec.name);
                html += `
                <div class="wa-pick-row" data-name="${frappe.utils.escape_html(rec.name)}"
                    data-display="${frappe.utils.escape_html(rec.display || rec.name)}"
                    style="display:flex;align-items:center;gap:12px;padding:10px 14px;
                    border-bottom:1px solid #f5f5f5;cursor:pointer;
                    background:${sel ? '#e8f5e9' : 'white'};transition:background .1s;">
                    <div style="width:20px;height:20px;border-radius:50%;flex-shrink:0;
                        border:2px solid ${sel ? WA_C.green : '#ccc'};
                        background:${sel ? WA_C.green : 'white'};
                        display:flex;align-items:center;justify-content:center;">
                        ${sel ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' : ''}
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:500;font-size:13px;white-space:nowrap;
                            overflow:hidden;text-overflow:ellipsis;
                            color:${sel ? WA_C.teal : '#333'};">
                            ${frappe.utils.escape_html(rec.display || rec.name)}
                            ${rec.status && !status_filter
                                ? `<span style="font-size:10px;padding:1px 7px;border-radius:8px;
                                    margin-left:5px;background:${rec.status==='Activo'?WA_C.green:'#aaa'};
                                    color:white;">${frappe.utils.escape_html(rec.status)}</span>` : ''}
                        </div>
                        ${rec.info ? `<div style="font-size:11px;color:${WA_C.text_meta};
                            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${frappe.utils.escape_html(rec.info)}</div>` : ''}
                    </div>
                </div>`;
            });
        }
        html += '</div>';
        html += `<div style="padding:6px 12px;font-size:12px;border-top:1px solid #eee;margin-top:4px;">
            ${selected_name === null
                ? `<span style="color:${WA_C.teal};font-weight:500;">✓ Todos os ${tipo} seleccionados</span>`
                : `<span style="color:${WA_C.teal};font-weight:500;">✓ Específico: ${frappe.utils.escape_html(selected_disp || selected_name)}</span>`}
        </div>`;

        d.fields_dict.list_html.$wrapper.html(html);

        d.fields_dict.list_html.$wrapper.find('.wa-pick-row')
            .hover(
                function () {
                    let n = $(this).data('name');
                    let active = (n === '' && selected_name === null) || n === selected_name;
                    if (!active) $(this).css('background', '#f0f9f7');
                },
                function () {
                    let n = $(this).data('name');
                    let active = (n === '' && selected_name === null) || n === selected_name;
                    $(this).css('background', active ? '#e8f5e9' : (n === '' ? '#fafafa' : 'white'));
                }
            )
            .on('click', function () {
                let n = $(this).data('name');
                let disp = $(this).data('display');
                selected_name = n === '' ? null : n;
                selected_disp = n === '' ? null : disp;
                render_list();
            });
    }

    frappe.call({
        method: 'whatsapp_notifications.whatsapp_notifications.doctype.envio_whatsapp_catequese.envio_whatsapp_catequese.get_registros_para_dialogo',
        args:   { doctype: doctype_map[tipo] },
        freeze: true,
        freeze_message: 'Carregando ' + tipo + '…',
        callback(r) {
            all_records = r.message || [];
            render_list();
            d.fields_dict.search.$input.on('input', () => render_list());
            if (has_status) d.fields_dict.filtro_status.$input.on('change', () => render_list());
        }
    });

    d.show();
    setTimeout(() => d.fields_dict.search && d.fields_dict.search.$input.focus(), 300);
}

// ── DocType dynamic dialog ───────────────────────────────────────────
function _show_doctype_dialog(frm, on_done) {
    let d = new frappe.ui.Dialog({
        title: 'Fonte DocType Dinâmico',
        size:  'large',
        fields: [
            { fieldname: 'doctype_fonte',       fieldtype: 'Link',   options: 'DocType',
              label: 'DocType', reqd: 1, description: 'Pesquise e seleccione qualquer DocType' },
            { fieldname: 'col_break',            fieldtype: 'Column Break' },
            { fieldname: 'campo_contacto',       fieldtype: 'Select', label: 'Campo de Contacto (telefone)',
              reqd: 1, options: '', description: 'Seleccione após escolher o DocType' },
            { fieldname: 'sec_child',            fieldtype: 'Section Break',
              label: 'Contactos numa Child Table', collapsible: 1 },
            { fieldname: 'usar_child_table',     fieldtype: 'Check',  label: 'Contactos estão numa child table' },
            { fieldname: 'child_table_field',    fieldtype: 'Select', label: 'Campo da Child Table',
              options: '', depends_on: 'eval:doc.usar_child_table==1' },
            { fieldname: 'campo_contacto_child', fieldtype: 'Select', label: 'Campo Contacto (na child)',
              options: '', depends_on: 'eval:doc.usar_child_table==1' },
            { fieldname: 'sec_filter',           fieldtype: 'Section Break', label: 'Filtro (opcional)', collapsible: 1 },
            { fieldname: 'filtro_campo',         fieldtype: 'Data', label: 'Campo de Filtro',
              description: 'Ex: status, departamento' },
            { fieldname: 'filtro_valor',         fieldtype: 'Data', label: 'Valor do Filtro',
              description: 'Ex: Activo, Sales' },
        ],
        primary_action_label: 'Adicionar Fonte',
        primary_action() {
            let vals = d.get_values();
            if (!vals || !vals.doctype_fonte) { frappe.msgprint('Seleccione o DocType.'); return; }
            let contact_field = vals.usar_child_table ? vals.campo_contacto_child : vals.campo_contacto;
            if (!contact_field) { frappe.msgprint('Seleccione o campo de contacto.'); return; }
            d.hide();
            _add_fonte(frm, {
                tipo_fonte:          'DocType',
                doctype_fonte:       vals.doctype_fonte,
                campo_contacto:      vals.campo_contacto      || '',
                usar_child_table:    vals.usar_child_table     || 0,
                child_table_field:   vals.child_table_field    || '',
                campo_contacto_child: vals.campo_contacto_child || '',
                filtro_campo:        vals.filtro_campo         || '',
                filtro_valor:        vals.filtro_valor         || '',
                descricao:           _build_descricao('DocType', vals),
            });
            if (on_done) on_done();
        },
    });

    function load_fields(dt) {
        if (!dt) return;
        frappe.call({
            method: 'whatsapp_notifications.whatsapp_notifications.doctype.aviso_whatsapp.aviso_whatsapp.get_doctype_phone_fields',
            args: { doctype: dt },
            callback(r) {
                let opts = '\n' + (r.message || []).map(f => f.fieldname).join('\n');
                d.fields_dict.campo_contacto.df.options       = opts;
                d.fields_dict.campo_contacto.refresh();
                d.fields_dict.campo_contacto_child.df.options = opts;
                d.fields_dict.campo_contacto_child.refresh();
                frappe.show_alert({ message: (r.message || []).length + ' campo(s) encontrado(s)', indicator: 'green' }, 3);
            }
        });
        frappe.call({
            method: 'whatsapp_notifications.whatsapp_notifications.doctype.aviso_whatsapp.aviso_whatsapp.get_doctype_child_tables',
            args: { doctype: dt },
            callback(r) {
                let opts = '\n' + (r.message || []).map(f => f.fieldname).join('\n');
                d.fields_dict.child_table_field.df.options = opts;
                d.fields_dict.child_table_field.refresh();
            }
        });
    }

    d.fields_dict.doctype_fonte.$input
        .on('awesomplete-selectcomplete', () => setTimeout(() => load_fields(d.get_value('doctype_fonte')), 100))
        .on('blur', () => load_fields(d.get_value('doctype_fonte')));

    d.show();
}

// ── Manual numbers dialog ────────────────────────────────────────────
function _show_manual_dialog(frm, on_done) {
    let d = new frappe.ui.Dialog({
        title: 'Adicionar Números Manuais',
        fields: [
            { fieldname: 'numeros',   fieldtype: 'Small Text', label: 'Números de Telefone', reqd: 1,
              description: 'Um número por linha. Pode incluir nome após o número.' },
            { fieldname: 'hint_html', fieldtype: 'HTML' },
        ],
        primary_action_label: 'Adicionar',
        primary_action(vals) {
            if (!vals.numeros || !vals.numeros.trim()) return;
            d.hide();
            let lines = vals.numeros.split('\n').filter(l => l.trim());
            let named = lines.filter(function(l) {
                let t = l.trim();
                if (t.includes('\t') || t.includes(' - ')) return true;
                let ci = t.indexOf(',');
                if (ci >= 0 && /[a-zA-Z\u00C0-\u00FF]/.test(t.slice(ci+1))) return true;
                let p = t.split(/\s+/);
                return p.length >= 2 && /^[\d+]{7,}$/.test(p[0].replace(/\+/g,'')) && /[a-zA-Z\u00C0-\u00FF]/.test(p.slice(1).join(' '));
            }).length;
            let descricao = lines.length + ' número(s) manual(is)' + (named > 0 ? ', ' + named + ' com nome' : '');
            _add_fonte(frm, { tipo_fonte: 'Numeros Manuais', numeros: vals.numeros, descricao });
            if (on_done) on_done();
        },
    });

    d.fields_dict.hint_html.$wrapper.html(`
    <div style="padding:8px 0;font-size:12px;color:${WA_C.text_meta};">
        <strong>Formatos suportados:</strong>
        <div style="font-family:monospace;background:#f5f6f7;border-radius:8px;
            padding:10px 14px;margin-top:6px;line-height:2;">
            840000000<br>
            860000001 Maria<br>
            870000002 - João<br>
            880000003,Ana
        </div>
        <div style="margin-top:8px;line-height:1.5;">
            O nome é <strong>opcional</strong>. Se fornecido, fica disponível como
            <code style="background:#f0f0f0;padding:1px 5px;border-radius:4px;">{{number_owner}}</code> na mensagem.<br>
            O código <strong>258</strong> é adicionado automaticamente.
        </div>
    </div>`);

    d.show();
    setTimeout(() => {
        if (d.fields_dict.numeros.$input)
            d.fields_dict.numeros.$input.attr('placeholder', '840123456\n860123456 Maria\n870123456 - João');
    }, 100);
}

// ── WhatsApp group picker (live from Evolution API) ──────────────────
function _show_grupo_dialog(frm, on_done) {
    frappe.call({
        method:          'whatsapp_notifications.whatsapp_notifications.api.fetch_whatsapp_groups',
        freeze:          true,
        freeze_message:  'Carregando grupos WhatsApp…',
        callback(r) {
            if (!r.message || !r.message.success) {
                frappe.msgprint({
                    title:     'Erro',
                    indicator: 'red',
                    message:   (r.message && r.message.error) || 'Não foi possível carregar os grupos WhatsApp.',
                });
                if (on_done) on_done();
                return;
            }

            let groups   = r.message.groups || [];
            let selected = new Set();

            let d = new frappe.ui.Dialog({
                title: 'Seleccionar Grupos WhatsApp',
                size:  'large',
                fields: [
                    { fieldname: 'search',    fieldtype: 'Data', placeholder: 'Pesquisar grupo…' },
                    { fieldname: 'list_html', fieldtype: 'HTML' },
                ],
                primary_action_label: 'Adicionar Grupos Seleccionados',
                primary_action() {
                    if (selected.size === 0) {
                        frappe.show_alert({ message: 'Seleccione pelo menos um grupo.', indicator: 'orange' }, 3);
                        return;
                    }
                    d.hide();
                    groups.filter(g => selected.has(g.id)).forEach(g => {
                        _add_fonte(frm, {
                            tipo_fonte: 'Grupo WhatsApp',
                            grupo_id:   g.id,
                            grupo_nome: g.subject || g.id,
                            descricao:  (g.subject || g.id) + (g.size ? ` (${g.size} membros)` : ''),
                        });
                    });
                    if (on_done) on_done();
                },
            });

            function render(filter_txt) {
                filter_txt = (filter_txt || '').toLowerCase();
                let filtered = groups.filter(g =>
                    (g.subject || '').toLowerCase().includes(filter_txt) ||
                    (g.id      || '').toLowerCase().includes(filter_txt)
                );

                let html = `<div style="border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;max-height:340px;overflow-y:auto;">`;
                if (filtered.length === 0) {
                    html += `<div style="padding:24px;text-align:center;color:${WA_C.text_meta};font-size:13px;">
                        Nenhum grupo encontrado.</div>`;
                } else {
                    filtered.forEach(g => {
                        let chk = selected.has(g.id);
                        html += `
                        <div class="wa-grp-row" data-id="${frappe.utils.escape_html(g.id)}"
                            style="display:flex;align-items:center;gap:12px;padding:11px 14px;
                            border-bottom:1px solid #f0f0f0;cursor:pointer;
                            background:${chk ? '#e8f5e9' : 'white'};transition:background .1s;">
                            <div style="width:22px;height:22px;border-radius:6px;flex-shrink:0;
                                border:2px solid ${chk ? WA_C.green : '#ccc'};
                                background:${chk ? WA_C.green : 'white'};
                                display:flex;align-items:center;justify-content:center;">
                                ${chk ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' : ''}
                            </div>
                            <div style="width:40px;height:40px;border-radius:50%;
                                background:${WA_C.dark_green};flex-shrink:0;
                                display:flex;align-items:center;justify-content:center;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                                </svg>
                            </div>
                            <div style="flex:1;min-width:0;">
                                <div style="font-weight:500;font-size:14px;white-space:nowrap;
                                    overflow:hidden;text-overflow:ellipsis;">
                                    ${frappe.utils.escape_html(g.subject || g.id)}
                                </div>
                                <div style="font-size:11px;color:${WA_C.text_meta};">
                                    ${g.size ? g.size + ' membros' : 'Grupo'}
                                </div>
                            </div>
                        </div>`;
                    });
                }
                html += '</div>';
                html += `<div style="padding:6px 12px;font-size:12px;color:${WA_C.text_meta};
                    border-top:1px solid #eee;margin-top:4px;">
                    ${selected.size > 0
                        ? `<span style="color:${WA_C.teal};font-weight:500;">✓ ${selected.size} grupo(s) seleccionado(s)</span>`
                        : 'Nenhum grupo seleccionado'}
                </div>`;

                d.fields_dict.list_html.$wrapper.html(html);

                d.fields_dict.list_html.$wrapper.find('.wa-grp-row')
                    .hover(
                        function () { if (!selected.has($(this).data('id'))) $(this).css('background', '#f0f9f7'); },
                        function () { if (!selected.has($(this).data('id'))) $(this).css('background', 'white'); }
                    )
                    .on('click', function () {
                        let id = $(this).data('id');
                        if (selected.has(id)) selected.delete(id); else selected.add(id);
                        render(d.get_value('search'));
                    });
            }

            render('');
            d.fields_dict.search.$input.on('input', function () { render($(this).val()); });
            d.show();
            setTimeout(() => d.fields_dict.search.$input.focus(), 200);
        }
    });
}

// ─────────────────────────────────────────────────────────────────────
// Shared fonte utilities
// ─────────────────────────────────────────────────────────────────────
function _build_descricao(tipo, v) {
    if (tipo === 'Catecumenos') {
        let p = [];
        if (v.filtro_status) p.push(v.filtro_status);
        p.push(v._display || v.nome_registo || 'Todos');
        if (v.incluir_padrinhos) p.push('+ Padrinhos');
        return p.join(' · ');
    }
    if (tipo === 'Catequistas') {
        let p = [];
        if (v.filtro_status) p.push(v.filtro_status);
        p.push(v._display || v.nome_registo || 'Todos');
        return p.join(' · ');
    }
    if (tipo === 'Turma')
        return v._display || v.nome_registo ? 'Turma: ' + (v._display || v.nome_registo) : 'Todas as Turmas';
    if (tipo === 'Preparacao Sacramento') {
        let s = v._display || v.nome_registo || 'Todas';
        if (v.incluir_padrinhos) s += ' + Padrinhos';
        return s;
    }
    if (tipo === 'DocType') {
        let b = (v.doctype_fonte || '?') + ' → ' + (v.campo_contacto || v.campo_contacto_child || '?');
        if (v.filtro_campo && v.filtro_valor) b += ' [' + v.filtro_campo + '=' + v.filtro_valor + ']';
        return b;
    }
    if (tipo === 'Numeros Manuais') {
        let lines = (v.numeros || '').split('\n').filter(l => l.trim());
        return lines.length + ' número(s) manual(is)';
    }
    if (tipo === 'Grupo WhatsApp') return v.grupo_nome || v.grupo_id || 'Grupo';
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
    let dt    = frappe.datetime.str_to_obj(datetime_str);
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
