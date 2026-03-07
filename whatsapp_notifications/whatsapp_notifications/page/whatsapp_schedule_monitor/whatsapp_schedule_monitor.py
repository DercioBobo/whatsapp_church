"""
WhatsApp Schedule Monitor - Server-side data for the monitoring page
"""
import frappe
from frappe.utils import today, getdate, now_datetime, get_datetime, add_days, nowdate


@frappe.whitelist()
def get_schedule_data():
    """
    Return all scheduled rule data for the monitor page:
    - Birthday rules with next run, today's matches, last run info
    - Days Before/After notification rules with target date, matches, sent count
    - Recent activity from scheduled rules
    """
    return {
        "birthday_rules": _get_birthday_rules(),
        "date_event_rules": _get_date_event_rules(),
        "recent_activity": _get_recent_activity(),
        "now": str(now_datetime()),
        "today": today(),
    }


# ---------------------------------------------------------------------------
# Birthday Rules
# ---------------------------------------------------------------------------

def _get_birthday_rules():
    rules = frappe.get_all(
        "WhatsApp Birthday Rule",
        fields=[
            "name", "document_type", "birthdate_field", "send_time", "days_before",
            "last_run", "last_count", "last_status", "last_error", "enabled",
            "send_to_person", "send_to_group", "send_to_additional"
        ],
        order_by="enabled desc, name asc"
    )

    today_str = today()
    now = now_datetime()

    for rule in rules:
        rule["was_run_today"] = (
            bool(rule.get("last_run")) and
            getdate(rule["last_run"]) == getdate(today_str)
        )
        rule["next_run"] = _calc_birthday_next_run(rule, today_str, now)
        rule["matches_today"] = _count_birthday_matches(rule, today_str)
        rule["send_channels"] = _birthday_channels(rule)
        # Clean up internal fields not needed in UI
        rule.pop("birthdate_field", None)

    return rules


def _calc_birthday_next_run(rule, today_str, now):
    if not rule.get("enabled"):
        return None
    if not rule.get("send_time"):
        return None

    send_time_dt = get_datetime("{} {}".format(today_str, rule["send_time"]))

    if rule.get("was_run_today"):
        tomorrow = add_days(today_str, 1)
        return "{} {}".format(tomorrow, rule["send_time"])
    elif now < send_time_dt:
        return "{} {}".format(today_str, rule["send_time"])
    else:
        # send_time passed today but rule didn't run yet
        return "overdue"


def _count_birthday_matches(rule, today_str):
    if not rule.get("document_type") or not rule.get("birthdate_field"):
        return 0
    try:
        target = getdate(add_days(today_str, rule.get("days_before") or 0))
        result = frappe.db.sql(
            """SELECT COUNT(*) FROM `tab{doctype}`
               WHERE MONTH(`{field}`) = %s AND DAY(`{field}`) = %s
               AND docstatus < 2""".format(
                doctype=rule["document_type"],
                field=rule["birthdate_field"]
            ),
            (target.month, target.day)
        )
        return int(result[0][0]) if result else 0
    except Exception:
        return 0


def _birthday_channels(rule):
    channels = []
    if rule.get("send_to_person"):
        channels.append("Person")
    if rule.get("send_to_group"):
        channels.append("Group")
    if rule.get("send_to_additional"):
        channels.append("Additional")
    return ", ".join(channels) if channels else "-"


# ---------------------------------------------------------------------------
# Days Before / After Notification Rules
# ---------------------------------------------------------------------------

def _get_date_event_rules():
    rules = frappe.get_all(
        "WhatsApp Notification Rule",
        filters={"event": ["in", ["Days Before", "Days After"]]},
        fields=[
            "name", "rule_name", "document_type", "event", "days_offset",
            "date_field", "enabled", "enable_active_hours",
            "active_hours_start", "active_hours_end", "send_once"
        ],
        order_by="enabled desc, document_type asc"
    )

    today_str = today()

    for rule in rules:
        target = _calc_target_date(rule, today_str)
        rule["target_date"] = str(target) if target else None
        rule["matches_today"] = _count_date_rule_matches(rule, target)
        rule["sent_today"] = _count_sent_today(rule["name"])
        rule["last_sent"] = _get_last_sent(rule["name"])
        rule["active_hours_label"] = _active_hours_label(rule)

    return rules


def _calc_target_date(rule, today_str):
    if not rule.get("days_offset"):
        return None
    offset = int(rule["days_offset"])
    if rule["event"] == "Days Before":
        return getdate(add_days(today_str, offset))
    else:  # Days After
        return getdate(add_days(today_str, -offset))


def _count_date_rule_matches(rule, target_date):
    if not rule.get("document_type") or not rule.get("date_field") or not target_date:
        return 0
    try:
        result = frappe.get_all(
            rule["document_type"],
            filters={rule["date_field"]: str(target_date)},
            pluck="name"
        )
        return len(result)
    except Exception:
        return 0


def _count_sent_today(rule_name):
    try:
        result = frappe.db.sql(
            """SELECT COUNT(*) FROM `tabWhatsApp Message Log`
               WHERE notification_rule = %s
               AND DATE(creation) = CURDATE()""",
            rule_name
        )
        return int(result[0][0]) if result else 0
    except Exception:
        return 0


def _get_last_sent(rule_name):
    try:
        result = frappe.db.sql(
            """SELECT creation FROM `tabWhatsApp Message Log`
               WHERE notification_rule = %s
               ORDER BY creation DESC LIMIT 1""",
            rule_name,
            as_dict=True
        )
        return str(result[0]["creation"]) if result else None
    except Exception:
        return None


def _active_hours_label(rule):
    if not rule.get("enable_active_hours"):
        return "Anytime"
    start = (rule.get("active_hours_start") or "")[:5]
    end = (rule.get("active_hours_end") or "")[:5]
    if start and end:
        return "{} – {}".format(start, end)
    return "Restricted"


# ---------------------------------------------------------------------------
# Recent Activity
# ---------------------------------------------------------------------------

def _get_recent_activity():
    # Collect names of all date-event notification rules
    date_rule_names = frappe.get_all(
        "WhatsApp Notification Rule",
        filters={"event": ["in", ["Days Before", "Days After"]]},
        pluck="name"
    )

    if not date_rule_names:
        return []

    try:
        logs = frappe.get_all(
            "WhatsApp Message Log",
            filters={"notification_rule": ["in", date_rule_names]},
            fields=[
                "name", "notification_rule", "reference_doctype", "reference_name",
                "recipient_name", "phone", "status", "creation", "error_message"
            ],
            order_by="creation desc",
            limit=30
        )
        return logs
    except Exception:
        return []
