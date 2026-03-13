frappe.pages["whatsapp-schedule-monitor"].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: "WhatsApp Schedule Monitor",
        single_column: true,
    });

    page.add_action_item(__("Refresh"), () => load_data(page));

    frappe.breadcrumbs.add("WhatsApp Notifications");

    $(wrapper).find(".layout-main-section").html(render_skeleton());

    load_data(page);
};

function load_data(page) {
    frappe.call({
        method: "whatsapp_notifications.whatsapp_notifications.page.whatsapp_schedule_monitor.whatsapp_schedule_monitor.get_schedule_data",
        callback: function (r) {
            if (r.message) {
                render_page(page, r.message);
            }
        },
        error: function () {
            frappe.msgprint(__("Error loading schedule data."));
        }
    });
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function render_skeleton() {
    return `<div class="schedule-monitor-container" style="padding:20px">
        <p class="text-muted">${__("Loading...")} </p>
    </div>`;
}

function render_page(page, data) {
    var now = frappe.datetime.str_to_user(data.now);
    var html = `
        <div class="schedule-monitor-container" style="padding:4px 0">
            <div class="text-muted" style="margin-bottom:18px;font-size:12px;">
                ${__("Last refreshed")}: <b>${now}</b>
                &nbsp;|&nbsp; ${__("Today")}: <b>${frappe.datetime.str_to_user(data.today)}</b>
            </div>
            ${render_bulk_sends_section(data.bulk_sends || [])}
            <div style="margin-top:28px"></div>
            ${render_birthday_section(data.birthday_rules)}
            <div style="margin-top:28px"></div>
            ${render_date_event_section(data.date_event_rules)}
            <div style="margin-top:28px"></div>
            ${render_recent_activity(data.recent_activity)}
        </div>`;

    $(page.wrapper).find(".layout-main-section").html(html);

    // Wire run-now buttons
    $(page.wrapper).find(".btn-run-birthday").on("click", function () {
        var rule = $(this).data("rule");
        run_birthday_now(rule, page);
    });

    // Wire retomar buttons
    $(page.wrapper).find(".btn-retomar-envio").on("click", function () {
        var envio_name = $(this).data("envio");
        retomar_envio(envio_name, page);
    });

    // Auto-refresh if any envio is running
    var has_running = (data.bulk_sends || []).some(e => e.status === 'Em Execução');
    if (has_running) {
        if (!page._bulk_refresh_timer) {
            page._bulk_refresh_timer = setInterval(() => load_data(page), 8000);
        }
    } else {
        if (page._bulk_refresh_timer) {
            clearInterval(page._bulk_refresh_timer);
            page._bulk_refresh_timer = null;
        }
    }
}

// ---------------------------------------------------------------------------
// Birthday Rules section
// ---------------------------------------------------------------------------

function render_birthday_section(rules) {
    var rows = (rules || []).map(r => render_birthday_row(r)).join("");

    return `
    <div class="card" style="${card_style()}">
        <div style="${section_header_style()}">
            <span style="font-size:16px;font-weight:600;">
                🎂 ${__("Birthday Rules")}
            </span>
            <span class="badge" style="background:#f0f4f8;color:#6c757d;padding:4px 10px;border-radius:20px;font-size:12px;">
                ${rules.length} ${__("rules")}
            </span>
        </div>
        ${rules.length === 0
            ? `<p class="text-muted" style="padding:16px;">${__("No birthday rules configured.")}</p>`
            : `<div style="overflow-x:auto;">
                <table class="table table-sm" style="${table_style()}">
                    <thead>
                        <tr style="background:#f8f9fa;">
                            <th>${__("Rule")}</th>
                            <th>${__("DocType")}</th>
                            <th>${__("Days Before")}</th>
                            <th>${__("Send Time")}</th>
                            <th>${__("Channels")}</th>
                            <th>${__("Status")}</th>
                            <th>${__("Today's Matches")}</th>
                            <th>${__("Next Run")}</th>
                            <th>${__("Last Run")}</th>
                            <th>${__("Last Result")}</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
               </div>`
        }
    </div>`;
}

function render_birthday_row(r) {
    var enabled_badge = r.enabled
        ? `<span style="${badge_style("green")}">${__("Active")}</span>`
        : `<span style="${badge_style("gray")}">${__("Disabled")}</span>`;

    var next_run_html = "";
    if (!r.enabled) {
        next_run_html = `<span class="text-muted">—</span>`;
    } else if (r.next_run === "overdue") {
        next_run_html = `<span style="${badge_style("orange")}">${__("Overdue")}</span>`;
    } else if (r.next_run) {
        next_run_html = frappe.datetime.str_to_user(r.next_run);
    } else {
        next_run_html = `<span class="text-muted">${__("No send time set")}</span>`;
    }

    var last_run_html = r.last_run
        ? frappe.datetime.str_to_user(r.last_run)
        : `<span class="text-muted">—</span>`;

    var last_result_html = r.last_status
        ? `<span title="${r.last_error || ""}">${r.last_status}${r.last_count ? ` (${r.last_count})` : ""}</span>`
        : `<span class="text-muted">—</span>`;

    var matches_html = `<b>${r.matches_today}</b>`;
    if (r.was_run_today) {
        matches_html += ` <span style="${badge_style("blue")}">${__("Sent")}</span>`;
    }

    var days_label = r.days_before == 0
        ? __("On the day")
        : `${r.days_before} ${__("day(s) before")}`;

    return `<tr>
        <td><a href="/app/whatsapp-birthday-rule/${r.name}">${r.name}</a></td>
        <td>${r.document_type || "—"}</td>
        <td>${days_label}</td>
        <td><b>${r.send_time || "—"}</b></td>
        <td style="font-size:11px;">${r.send_channels || "—"}</td>
        <td>${enabled_badge}</td>
        <td style="text-align:center;">${matches_html}</td>
        <td>${next_run_html}</td>
        <td style="font-size:12px;">${last_run_html}</td>
        <td style="font-size:12px;">${last_result_html}</td>
        <td>
            <button class="btn btn-xs btn-default btn-run-birthday" data-rule="${r.name}">
                ${__("Run Now")}
            </button>
        </td>
    </tr>`;
}

function run_birthday_now(rule_name, page) {
    frappe.confirm(
        __("Run birthday rule <b>{0}</b> now?", [rule_name]),
        function () {
            frappe.call({
                method: "whatsapp_notifications.whatsapp_notifications.doctype.whatsapp_birthday_rule.whatsapp_birthday_rule.run_now",
                args: { doctype: "WhatsApp Birthday Rule", docname: rule_name, force: 1 },
                callback: function (r) {
                    if (r.message) {
                        var m = r.message;
                        frappe.msgprint(
                            __("Sent: {0} | Skipped: {1} | Errors: {2}", [m.sent, m.skipped, m.errors.length])
                        );
                        load_data(page);
                    }
                }
            });
        }
    );
}

// ---------------------------------------------------------------------------
// Days Before / After Rules section
// ---------------------------------------------------------------------------

function render_date_event_section(rules) {
    var rows = (rules || []).map(r => render_date_event_row(r)).join("");

    return `
    <div class="card" style="${card_style()}">
        <div style="${section_header_style()}">
            <span style="font-size:16px;font-weight:600;">
                📅 ${__("Days Before / After Rules")}
            </span>
            <span class="badge" style="background:#f0f4f8;color:#6c757d;padding:4px 10px;border-radius:20px;font-size:12px;">
                ${rules.length} ${__("rules")}
            </span>
        </div>
        ${rules.length === 0
            ? `<p class="text-muted" style="padding:16px;">${__("No Days Before / After rules configured.")}</p>`
            : `<div style="overflow-x:auto;">
                <table class="table table-sm" style="${table_style()}">
                    <thead>
                        <tr style="background:#f8f9fa;">
                            <th>${__("Rule Name")}</th>
                            <th>${__("DocType")}</th>
                            <th>${__("Event")}</th>
                            <th>${__("Date Field")}</th>
                            <th>${__("Target Date")}</th>
                            <th>${__("Status")}</th>
                            <th>${__("Matches Today")}</th>
                            <th>${__("Sent Today")}</th>
                            <th>${__("Active Hours")}</th>
                            <th>${__("Last Sent")}</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
               </div>`
        }
    </div>`;
}

function render_date_event_row(r) {
    var enabled_badge = r.enabled
        ? `<span style="${badge_style("green")}">${__("Active")}</span>`
        : `<span style="${badge_style("gray")}">${__("Disabled")}</span>`;

    var event_label = r.event === "Days Before"
        ? `<span style="color:#e65100;">${r.days_offset} ${__("day(s) before")}</span>`
        : `<span style="color:#1565c0;">${r.days_offset} ${__("day(s) after")}</span>`;

    var matches_html = (r.matches_today || 0).toString();
    if (r.matches_today > 0 && r.sent_today === 0) {
        matches_html = `<b style="color:#e65100;">${r.matches_today}</b>
            <span style="${badge_style("orange")}">${__("Pending")}</span>`;
    } else if (r.matches_today > 0 && r.sent_today > 0) {
        matches_html = `<b>${r.matches_today}</b>`;
    }

    var sent_today_html = r.sent_today > 0
        ? `<b style="color:#2e7d32;">${r.sent_today}</b>`
        : `<span class="text-muted">0</span>`;

    var last_sent_html = r.last_sent
        ? `<span style="font-size:11px;">${frappe.datetime.str_to_user(r.last_sent)}</span>`
        : `<span class="text-muted">—</span>`;

    return `<tr>
        <td><a href="/app/whatsapp-notification-rule/${r.name}">${r.rule_name || r.name}</a></td>
        <td>${r.document_type || "—"}</td>
        <td>${event_label}</td>
        <td style="font-size:12px;">${r.date_field || "—"}</td>
        <td style="font-size:12px;"><b>${r.target_date || "—"}</b></td>
        <td>${enabled_badge}</td>
        <td style="text-align:center;">${matches_html}</td>
        <td style="text-align:center;">${sent_today_html}</td>
        <td style="font-size:12px;">${r.active_hours_label || "Anytime"}</td>
        <td>${last_sent_html}</td>
    </tr>`;
}

// ---------------------------------------------------------------------------
// Recent Activity
// ---------------------------------------------------------------------------

function render_recent_activity(logs) {
    if (!logs || logs.length === 0) {
        return `
        <div class="card" style="${card_style()}">
            <div style="${section_header_style()}">
                <span style="font-size:16px;font-weight:600;">📨 ${__("Recent Activity")}</span>
            </div>
            <p class="text-muted" style="padding:16px;">${__("No recent activity from scheduled rules.")}</p>
        </div>`;
    }

    var rows = logs.map(function (log) {
        var status_color = {
            "Sent": "green", "Failed": "red", "Pending": "orange",
            "Queued": "blue", "Sending": "blue"
        }[log.status] || "gray";

        var status_badge = `<span style="${badge_style(status_color)}">${log.status}</span>`;

        var rule_link = log.notification_rule
            ? `<a href="/app/whatsapp-notification-rule/${log.notification_rule}" style="font-size:11px;">${log.notification_rule}</a>`
            : "—";

        var doc_link = log.reference_doctype && log.reference_name
            ? `<a href="/app/${frappe.router.slug(log.reference_doctype)}/${log.reference_name}" style="font-size:11px;">${log.reference_name}</a>`
            : "—";

        var error_html = log.error_message
            ? `<span class="text-danger" title="${log.error_message}" style="font-size:10px;cursor:help;">⚠</span>`
            : "";

        return `<tr>
            <td style="font-size:11px;">${frappe.datetime.str_to_user(log.creation)}</td>
            <td>${rule_link}</td>
            <td style="font-size:11px;">${log.reference_doctype || "—"}</td>
            <td>${doc_link}</td>
            <td style="font-size:12px;">${log.recipient_name || log.phone || "—"}</td>
            <td>${status_badge} ${error_html}</td>
        </tr>`;
    }).join("");

    return `
    <div class="card" style="${card_style()}">
        <div style="${section_header_style()}">
            <span style="font-size:16px;font-weight:600;">📨 ${__("Recent Activity")}</span>
            <span class="badge" style="background:#f0f4f8;color:#6c757d;padding:4px 10px;border-radius:20px;font-size:12px;">
                ${__("Last")} ${logs.length} ${__("messages")}
            </span>
        </div>
        <div style="overflow-x:auto;">
            <table class="table table-sm" style="${table_style()}">
                <thead>
                    <tr style="background:#f8f9fa;">
                        <th>${__("Time")}</th>
                        <th>${__("Rule")}</th>
                        <th>${__("DocType")}</th>
                        <th>${__("Document")}</th>
                        <th>${__("Recipient")}</th>
                        <th>${__("Status")}</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Bulk Sends section
// ---------------------------------------------------------------------------

function render_bulk_sends_section(envios) {
    var rows = (envios || []).map(e => render_bulk_send_row(e)).join("");

    return `
    <div class="card" style="${card_style()}">
        <div style="${section_header_style()}">
            <span style="font-size:16px;font-weight:600;">
                📤 ${__("Envios em Massa")}
            </span>
            <span class="badge" style="background:#f0f4f8;color:#6c757d;padding:4px 10px;border-radius:20px;font-size:12px;">
                ${envios.length} ${__("envios")}
            </span>
        </div>
        ${envios.length === 0
            ? `<p class="text-muted" style="padding:16px;">${__("Nenhum envio em massa encontrado.")}</p>`
            : `<div style="overflow-x:auto;">
                <table class="table table-sm" style="${table_style()}">
                    <thead>
                        <tr style="background:#f8f9fa;">
                            <th>${__("Envio")}</th>
                            <th>${__("Aviso")}</th>
                            <th>${__("Status")}</th>
                            <th>${__("Progresso")}</th>
                            <th>${__("Total")}</th>
                            <th>${__("Enviados")}</th>
                            <th>${__("Falhados")}</th>
                            <th>${__("Disparado Por")}</th>
                            <th>${__("Iniciado Em")}</th>
                            <th>${__("Concluído Em")}</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
               </div>`
        }
    </div>`;
}

function render_bulk_send_row(e) {
    var status_colors = {
        "Preparando": "blue", "Em Execução": "blue",
        "Concluído": "green", "Interrompido": "orange", "Falhado": "red"
    };
    var status_badge = `<span style="${badge_style(status_colors[e.status] || 'gray')}">${e.status}</span>`;
    if (e.possivelmente_interrompido) {
        status_badge += ` <span style="${badge_style('orange')}" title="${__('Sem heartbeat há mais de 15 min')}">⚠</span>`;
    }

    var pct = e.progresso || 0;
    var bar_color = e.status === 'Concluído' ? '#4caf50' : (e.status === 'Em Execução' ? '#2196f3' : (e.falhados > 0 ? '#ff9800' : '#9e9e9e'));
    var progress_html = `
        <div style="min-width:120px;">
            <div style="font-size:11px;margin-bottom:2px;">${pct}% (${(e.enviados||0)+(e.falhados||0)}/${e.total||0})</div>
            <div style="height:6px;background:#e0e0e0;border-radius:3px;">
                <div style="height:100%;width:${pct}%;background:${bar_color};border-radius:3px;"></div>
            </div>
        </div>`;

    var aviso_link = e.aviso
        ? `<a href="/app/aviso-whatsapp/${e.aviso}" style="font-size:12px;">${e.titulo || e.aviso}</a>`
        : '—';

    var iniciado = e.iniciado_em ? `<span style="font-size:11px;">${frappe.datetime.str_to_user(e.iniciado_em)}</span>` : '—';
    var concluido = e.concluido_em ? `<span style="font-size:11px;">${frappe.datetime.str_to_user(e.concluido_em)}</span>` : '—';

    var can_resume = ['Em Execução', 'Interrompido', 'Falhado'].includes(e.status) && (e.pendentes || 0) > 0;
    var action_btn = can_resume
        ? `<button class="btn btn-xs btn-warning btn-retomar-envio" data-envio="${e.name}">↺ ${__("Retomar")}</button>`
        : `<a href="/app/envio-em-massa-whatsapp/${e.name}" class="btn btn-xs btn-default">${__("Ver")}</a>`;

    return `<tr>
        <td><a href="/app/envio-em-massa-whatsapp/${e.name}" style="font-size:12px;">${e.name}</a></td>
        <td>${aviso_link}</td>
        <td>${status_badge}</td>
        <td>${progress_html}</td>
        <td style="text-align:center;">${e.total || 0}</td>
        <td style="text-align:center;color:#2e7d32;"><b>${e.enviados || 0}</b></td>
        <td style="text-align:center;color:#c62828;">${e.falhados || 0}</td>
        <td style="font-size:11px;">${e.disparado_por || '—'}</td>
        <td>${iniciado}</td>
        <td>${concluido}</td>
        <td>${action_btn}</td>
    </tr>`;
}

function retomar_envio(envio_name, page) {
    frappe.confirm(
        __("Retomar o envio <b>{0}</b>?", [envio_name]),
        function () {
            frappe.call({
                method: "whatsapp_notifications.whatsapp_notifications.doctype.envio_em_massa_whatsapp.envio_em_massa_whatsapp.retomar_envio",
                args: { envio_name: envio_name },
                callback: function(r) {
                    if (r.message && r.message.queued) {
                        frappe.show_alert({ message: __("Envio retomado! {0} pendentes.", [r.message.pendentes]), indicator: "green" });
                        setTimeout(() => load_data(page), 2000);
                    }
                }
            });
        }
    );
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

function card_style() {
    return "border:1px solid #e0e0e0;border-radius:8px;background:#fff;overflow:hidden;";
}

function section_header_style() {
    return "display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #f0f0f0;";
}

function table_style() {
    return "margin:0;font-size:13px;";
}

function badge_style(color) {
    var colors = {
        green:  "background:#e8f5e9;color:#2e7d32;",
        red:    "background:#ffebee;color:#c62828;",
        orange: "background:#fff3e0;color:#e65100;",
        blue:   "background:#e3f2fd;color:#1565c0;",
        gray:   "background:#f5f5f5;color:#757575;",
    };
    return `display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:500;${colors[color] || colors.gray}`;
}
