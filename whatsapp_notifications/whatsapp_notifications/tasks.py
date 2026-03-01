"""
WhatsApp Notifications - Scheduled Tasks
Background processing for message queue and maintenance
"""
import frappe
from frappe import _
from frappe.utils import now_datetime, add_to_date


def process_pending_messages():
    """
    Process pending messages from the queue
    Called every minute by scheduler
    """
    from whatsapp_notifications.whatsapp_notifications.doctype.evolution_api_settings.evolution_api_settings import get_settings
    from whatsapp_notifications.whatsapp_notifications.doctype.whatsapp_message_log.whatsapp_message_log import get_pending_messages
    from whatsapp_notifications.whatsapp_notifications.api import process_message_log, process_media_message_log

    try:
        settings = get_settings()

        if not settings.get("enabled"):
            return

        # Get pending messages
        messages = get_pending_messages(limit=50)

        if not messages:
            return

        # Rate limiting
        rate_limit = None
        if settings.get("enable_rate_limiting"):
            rate_limit = settings.get("messages_per_minute", 20)

        processed = 0

        for msg_name in messages:
            # Check rate limit
            if rate_limit and processed >= rate_limit:
                if settings.get("enable_debug_logging"):
                    frappe.log_error(
                        "Rate limit reached: {} messages".format(processed),
                        "WhatsApp Rate Limit"
                    )
                break

            try:
                # Check message type to determine which processor to use
                message_type = frappe.db.get_value("WhatsApp Message Log", msg_name, "message_type")

                if message_type in ("Media", "Document"):
                    result = process_media_message_log(msg_name)
                else:
                    result = process_message_log(msg_name)

                processed += 1

                # Small delay between messages to avoid overwhelming the API
                if processed < len(messages):
                    import time
                    time.sleep(0.5)

            except Exception as e:
                frappe.log_error(
                    "Error processing message {}: {}".format(msg_name, str(e)),
                    "WhatsApp Process Error"
                )

        if settings.get("enable_debug_logging") and processed > 0:
            frappe.log_error(
                "Processed {} pending messages".format(processed),
                "WhatsApp Debug"
            )

        frappe.db.commit()

    except Exception as e:
        frappe.log_error(
            "WhatsApp Queue Error: {}".format(str(e)),
            "WhatsApp Queue Error"
        )


def retry_failed_messages():
    """
    Retry failed messages AND recover stale pending/sending messages
    Called every 5 minutes by scheduler

    Handles:
    1. Failed messages that haven't exceeded retry limit
    2. Stale Pending/Queued messages (worker crash recovery)
    3. Stale Sending messages (stuck in transit)
    """
    from whatsapp_notifications.whatsapp_notifications.doctype.evolution_api_settings.evolution_api_settings import get_settings
    from whatsapp_notifications.whatsapp_notifications.api import process_message_log, process_media_message_log

    def process_by_type(msg_name):
        """Process message based on its type"""
        message_type = frappe.db.get_value("WhatsApp Message Log", msg_name, "message_type")
        if message_type in ("Media", "Document"):
            return process_media_message_log(msg_name)
        else:
            return process_message_log(msg_name)

    try:
        settings = get_settings()

        if not settings.get("enabled"):
            return

        max_retries = settings.get("max_retries", 3)
        retry_delay = settings.get("retry_delay_minutes", 5)

        # Calculate cutoff time for stale messages
        cutoff = add_to_date(now_datetime(), minutes=-retry_delay)

        retried = 0
        recovered = 0

        # 1. Get failed messages eligible for retry
        failed_messages = frappe.get_all(
            "WhatsApp Message Log",
            filters={
                "status": "Failed",
                "retry_count": ["<", max_retries],
                "modified": ["<=", cutoff]
            },
            order_by="modified asc",
            limit_page_length=20,
            pluck="name"
        )

        for msg_name in failed_messages:
            try:
                retry_count = frappe.db.get_value("WhatsApp Message Log", msg_name, "retry_count") or 0

                # Reset status and increment retry count
                frappe.db.set_value(
                    "WhatsApp Message Log",
                    msg_name,
                    {
                        "status": "Pending",
                        "retry_count": retry_count + 1,
                        "error_message": None
                    }
                )
                frappe.db.commit()

                # Actually send based on message type
                process_by_type(msg_name)
                retried += 1

            except Exception as e:
                frappe.log_error(
                    "Error retrying message {}: {}".format(msg_name, str(e)),
                    "WhatsApp Retry Error"
                )

        # 2. Recover stale Pending/Queued messages (worker crash recovery)
        stale_pending = frappe.get_all(
            "WhatsApp Message Log",
            filters={
                "status": ["in", ["Pending", "Queued"]],
                "modified": ["<=", cutoff],
                "scheduled_time": ["is", "not set"]  # Not scheduled for future
            },
            order_by="modified asc",
            limit_page_length=20,
            pluck="name"
        )

        for msg_name in stale_pending:
            try:
                process_by_type(msg_name)
                recovered += 1
            except Exception as e:
                frappe.log_error(
                    "Error recovering stale message {}: {}".format(msg_name, str(e)),
                    "WhatsApp Recovery Error"
                )

        # 3. Recover stale Sending messages (stuck in transit > 10 min)
        sending_cutoff = add_to_date(now_datetime(), minutes=-10)
        stale_sending = frappe.get_all(
            "WhatsApp Message Log",
            filters={
                "status": "Sending",
                "modified": ["<=", sending_cutoff]
            },
            order_by="modified asc",
            limit_page_length=10,
            pluck="name"
        )

        for msg_name in stale_sending:
            try:
                retry_count = frappe.db.get_value("WhatsApp Message Log", msg_name, "retry_count") or 0

                if retry_count < max_retries:
                    # Reset to Pending and retry
                    frappe.db.set_value(
                        "WhatsApp Message Log",
                        msg_name,
                        {
                            "status": "Pending",
                            "retry_count": retry_count + 1,
                            "error_message": "Recovered from stale Sending status"
                        }
                    )
                    frappe.db.commit()

                    process_by_type(msg_name)
                    recovered += 1
                else:
                    # Max retries exceeded, mark as failed
                    frappe.db.set_value(
                        "WhatsApp Message Log",
                        msg_name,
                        {
                            "status": "Failed",
                            "error_message": "Max retries exceeded (stuck in Sending)"
                        }
                    )
                    frappe.db.commit()

            except Exception as e:
                frappe.log_error(
                    "Error recovering sending message {}: {}".format(msg_name, str(e)),
                    "WhatsApp Recovery Error"
                )

        if settings.get("enable_debug_logging") and (retried > 0 or recovered > 0):
            frappe.log_error(
                "Retried {} failed, recovered {} stale messages".format(retried, recovered),
                "WhatsApp Debug"
            )

        frappe.db.commit()

    except Exception as e:
        frappe.log_error(
            "WhatsApp Retry Error: {}".format(str(e)),
            "WhatsApp Retry Error"
        )


def cleanup_old_logs():
    """
    Delete old message logs based on retention settings
    Called daily at 2 AM by scheduler
    """
    from whatsapp_notifications.whatsapp_notifications.doctype.evolution_api_settings.evolution_api_settings import get_settings
    from whatsapp_notifications.whatsapp_notifications.doctype.whatsapp_message_log.whatsapp_message_log import cleanup_old_logs as do_cleanup
    
    try:
        settings = get_settings()
        
        retention_days = settings.get("log_retention_days", 30)
        
        if retention_days <= 0:
            # Keep forever
            return
        
        deleted = do_cleanup(days=retention_days)
        
        if deleted > 0:
            frappe.log_error(
                "Cleaned up {} old WhatsApp message logs".format(deleted),
                "WhatsApp Cleanup"
            )
        
    except Exception as e:
        frappe.log_error(
            "WhatsApp Cleanup Error: {}".format(str(e)),
            "WhatsApp Cleanup Error"
        )


# ============================================================
# Manual Trigger Functions
# ============================================================

@frappe.whitelist()
def trigger_pending_processing():
    """
    Manually trigger processing of pending messages
    Can be called from admin interface
    """
    frappe.enqueue(
        "whatsapp_notifications.whatsapp_notifications.tasks.process_pending_messages",
        queue="short",
        now=True
    )
    return {"status": "triggered"}


@frappe.whitelist()
def trigger_retry_processing():
    """
    Manually trigger retry of failed messages
    Can be called from admin interface
    """
    frappe.enqueue(
        "whatsapp_notifications.whatsapp_notifications.tasks.retry_failed_messages",
        queue="short",
        now=True
    )
    return {"status": "triggered"}


@frappe.whitelist()
def trigger_cleanup():
    """
    Manually trigger log cleanup
    Can be called from admin interface
    """
    frappe.enqueue(
        "whatsapp_notifications.whatsapp_notifications.tasks.cleanup_old_logs",
        queue="long",
        now=True
    )
    return {"status": "triggered"}


def process_date_event_rules():
    """
    Process 'Days Before' and 'Days After' notification rules.
    Finds documents where a date field matches today +/- the configured offset,
    and sends WhatsApp notifications for each match.
    Called daily by scheduler.
    """
    from frappe.utils import nowdate, add_days, getdate
    from whatsapp_notifications.whatsapp_notifications.doctype.evolution_api_settings.evolution_api_settings import get_settings
    from whatsapp_notifications.whatsapp_notifications.events import process_rule

    try:
        settings = get_settings()
        if not settings.get("enabled"):
            return

        today = getdate(nowdate())

        rule_names = frappe.get_all(
            "WhatsApp Notification Rule",
            filters={"enabled": 1, "event": ["in", ["Days Before", "Days After"]]},
            pluck="name"
        )

        for rule_name in rule_names:
            try:
                rule = frappe.get_doc("WhatsApp Notification Rule", rule_name)
                _process_date_rule(rule, today, settings, process_rule)
            except Exception as e:
                frappe.log_error(
                    "Error processing date rule {}: {}".format(rule_name, str(e)),
                    "WhatsApp Date Rule Error"
                )

    except Exception as e:
        frappe.log_error(
            "WhatsApp Date Rules Error: {}".format(str(e)),
            "WhatsApp Date Rules Error"
        )


def _process_date_rule(rule, today, settings, process_rule_fn):
    """
    Process a single Days Before/After rule against all matching documents.

    Args:
        rule: WhatsApp Notification Rule document
        today: date object for today
        settings: Evolution API settings dict
        process_rule_fn: function reference for process_rule (to avoid circular import)
    """
    from frappe.utils import add_days
    from whatsapp_notifications.whatsapp_notifications.doctype.whatsapp_notification_rule.whatsapp_notification_rule import has_sent_for_rule

    if not rule.date_field or not rule.days_offset:
        return

    # Calculate target date: the document's date field value we're looking for
    if rule.event == "Days Before":
        # Notify X days BEFORE the event → find docs where date_field = today + X
        target_date = add_days(today, rule.days_offset)
    else:  # Days After
        # Notify X days AFTER the event → find docs where date_field = today - X
        target_date = add_days(today, -rule.days_offset)

    if not rule.is_within_active_hours():
        return

    try:
        doc_names = frappe.get_all(
            rule.document_type,
            filters={rule.date_field: str(target_date)},
            pluck="name"
        )
    except Exception as e:
        frappe.log_error(
            "Date rule {} - error querying '{}' with {}={}: {}".format(
                rule.name, rule.document_type, rule.date_field, target_date, str(e)
            ),
            "WhatsApp Date Rule Query Error"
        )
        return

    for docname in doc_names:
        try:
            # Prevent duplicate sends within the same day (multiple scheduler runs)
            sent_today = frappe.db.exists("WhatsApp Message Log", {
                "notification_rule": rule.name,
                "reference_doctype": rule.document_type,
                "reference_name": docname,
                "status": ["in", ["Sent", "Pending", "Sending", "Queued"]],
                "creation": [">=", frappe.utils.today()]
            })
            if sent_today:
                continue

            # Respect send_once: never resend if already sent for this doc
            if rule.send_once and has_sent_for_rule(rule.name, rule.document_type, docname):
                continue

            doc = frappe.get_doc(rule.document_type, docname)
            process_rule_fn(doc, rule, settings)

        except Exception as e:
            frappe.log_error(
                "Date rule {} - error processing doc {}: {}".format(rule.name, docname, str(e)),
                "WhatsApp Date Rule Error"
            )


def process_birthday_rules():
    """
    Check all enabled birthday rules and enqueue those whose send_time window is now.
    Called hourly by scheduler.
    """
    try:
        rules = frappe.get_all(
            "WhatsApp Birthday Rule",
            filters={"enabled": 1},
            pluck="name"
        )

        for rule_name in rules:
            try:
                rule = frappe.get_doc("WhatsApp Birthday Rule", rule_name)

                if rule.is_time_to_send() and not rule.was_run_today():
                    frappe.enqueue(
                        "whatsapp_notifications.whatsapp_notifications.doctype.whatsapp_birthday_rule.whatsapp_birthday_rule.process_birthday_rule",
                        rule_name=rule_name,
                        queue="long"
                    )

            except Exception as e:
                frappe.log_error(
                    "Error checking birthday rule {}: {}".format(rule_name, str(e)),
                    "WhatsApp Birthday Rule Scheduler Error"
                )

    except Exception as e:
        frappe.log_error(
            "WhatsApp Birthday Rules scheduler error: {}".format(str(e)),
            "WhatsApp Birthday Rule Scheduler Error"
        )
