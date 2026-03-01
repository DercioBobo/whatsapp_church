"""
WhatsApp Notification Rule - Defines when and how to send WhatsApp notifications
"""
import frappe
from frappe.model.document import Document
from frappe import _
import json


class WhatsAppNotificationRule(Document):
    """
    Notification Rule Configuration
    Defines triggers, conditions, recipients, and message templates
    """
    
    def validate(self):
        """Validate rule configuration"""
        self.validate_document_type()
        self.validate_phone_field()
        self.validate_date_event()
        self.validate_template()
        self.validate_condition()
        self.validate_time_settings()
    
    def validate_document_type(self):
        """Ensure document type exists"""
        if self.document_type and not frappe.db.exists("DocType", self.document_type):
            frappe.throw(_("Document Type '{}' does not exist").format(self.document_type))
    
    def validate_phone_field(self):
        """Validate phone field exists in DocType or child table"""
        needs_phone = self.recipient_type in ("Field Value", "Both", "Phone and Group")

        if needs_phone and self.use_child_table and self.document_type:
            if not self.child_table:
                frappe.throw(_("Child Table is required when 'Send to Child Table Rows' is enabled"))
            if not self.child_phone_field:
                frappe.throw(_("Child Table Phone Field is required when 'Send to Child Table Rows' is enabled"))

            meta = frappe.get_meta(self.document_type)
            child_field = meta.get_field(self.child_table)
            if not child_field or child_field.fieldtype != "Table":
                frappe.throw(
                    _("'{}' is not a valid Table field in {}").format(
                        self.child_table, self.document_type
                    )
                )
            if child_field.options:
                child_meta = frappe.get_meta(child_field.options)
                if not child_meta.has_field(self.child_phone_field):
                    frappe.msgprint(
                        _("Warning: Field '{}' not found in child table '{}'").format(
                            self.child_phone_field, child_field.options
                        ),
                        indicator="orange"
                    )
        elif needs_phone and not self.use_child_table and self.phone_field and self.document_type:
            meta = frappe.get_meta(self.document_type)
            if not meta.has_field(self.phone_field):
                frappe.msgprint(
                    _("Warning: Field '{}' not found in {}. Make sure it exists.").format(
                        self.phone_field, self.document_type
                    ),
                    indicator="orange"
                )

        # Validate child_watch_fields against the actual child table schema
        if self.child_watch_fields and self.use_child_table and self.child_table and self.document_type:
            meta = frappe.get_meta(self.document_type)
            child_field = meta.get_field(self.child_table)
            if child_field and child_field.options:
                child_meta = frappe.get_meta(child_field.options)
                child_fieldnames = {df.fieldname for df in child_meta.fields}
                unknown = [
                    f.strip()
                    for f in self.child_watch_fields.split(",")
                    if f.strip() and f.strip() not in child_fieldnames
                ]
                if unknown:
                    frappe.msgprint(
                        _("Warning: These Watch Fields were not found in the child table: {}").format(
                            ", ".join(unknown)
                        ),
                        indicator="orange"
                    )

    def validate_date_event(self):
        """Validate Days Before / Days After event settings"""
        if self.event not in ("Days Before", "Days After"):
            return
        if not self.date_field:
            frappe.throw(_("'Date Field' is required for the '{}' event").format(self.event))
        if not self.days_offset or self.days_offset <= 0:
            frappe.throw(_("'Days' must be a positive number for the '{}' event").format(self.event))
        if self.document_type:
            meta = frappe.get_meta(self.document_type)
            field = meta.get_field(self.date_field)
            if not field:
                frappe.throw(
                    _("Field '{}' not found in DocType '{}'").format(self.date_field, self.document_type)
                )
            if field.fieldtype not in ("Date", "Datetime"):
                frappe.throw(
                    _("Field '{}' must be a Date or Datetime field for '{}' event").format(
                        self.date_field, self.event
                    )
                )
    
    def validate_template(self):
        """Test template syntax"""
        dummy_row = frappe._dict({"name": "TEST", "idx": 1})
        dummy_context = {
            "doc": frappe._dict({"name": "TEST"}),
            "row": dummy_row,
            "changed_fields": [],
            "changed_values": {},
            "previous_values": {},
            "row_before": frappe._dict(),
            "frappe": frappe
        }
        if self.message_template:
            try:
                # Test render with dummy data (include row and diff vars for child table templates)
                frappe.render_template(self.message_template, dummy_context)
            except (frappe.DoesNotExistError, frappe.ValidationError):
                # Template is syntactically valid but relies on real linked docs — that's fine
                pass
            except Exception as e:
                frappe.throw(_("Invalid message template: {}").format(str(e)))

        if self.owner_message_template:
            try:
                frappe.render_template(self.owner_message_template, dummy_context)
            except (frappe.DoesNotExistError, frappe.ValidationError):
                pass
            except Exception as e:
                frappe.throw(_("Invalid owner message template: {}").format(str(e)))
    
    def validate_condition(self):
        """Test condition syntax"""
        if self.condition:
            try:
                # Test render with dummy data
                test_context = {"doc": frappe._dict({"name": "TEST", "status": "Test"}), "frappe": frappe}
                result = frappe.render_template(self.condition, test_context)
                # Result should be truthy/falsy
            except (frappe.DoesNotExistError, frappe.ValidationError):
                pass
            except Exception as e:
                frappe.throw(_("Invalid condition: {}").format(str(e)))
    
    def validate_time_settings(self):
        """Validate active hours settings"""
        import re

        # If active hours restriction is not enabled, clear the time fields
        if not self.enable_active_hours:
            self.active_hours_start = None
            self.active_hours_end = None
            return

        # If enabled, both times are required
        if not self.active_hours_start or not self.active_hours_end:
            frappe.throw(_("Both Active Hours Start and End must be set when 'Restrict to Active Hours' is enabled"))

        # Validate time format (HH:MM or HH:MM:SS)
        time_pattern = re.compile(r'^([01]?[0-9]|2[0-3]):([0-5][0-9])(:[0-5][0-9])?$')

        if not time_pattern.match(self.active_hours_start):
            frappe.throw(_("Active Hours Start must be in HH:MM format (e.g., 09:00)"))

        if not time_pattern.match(self.active_hours_end):
            frappe.throw(_("Active Hours End must be in HH:MM format (e.g., 18:00)"))

        # Normalize to HH:MM:SS format
        if len(self.active_hours_start) == 5:
            self.active_hours_start = self.active_hours_start + ":00"
        if len(self.active_hours_end) == 5:
            self.active_hours_end = self.active_hours_end + ":00"
    
    def on_update(self):
        """Clear cache when rules change"""
        clear_rules_cache()
    
    def on_trash(self):
        """Clear cache when rule deleted"""
        clear_rules_cache()
    
    def is_applicable(self, doc, event):
        """
        Check if this rule should fire for the given document and event
        
        Args:
            doc: The document being processed
            event: The event type (after_insert, on_update, etc.)
        
        Returns:
            bool: True if rule should fire
        """
        # Check if enabled
        if not self.enabled:
            return False
        
        # Check document type
        if doc.doctype != self.document_type:
            return False
        
        # Check event matches
        event_map = {
            "after_insert": "After Insert",
            "on_update": "On Update",
            "on_submit": "On Submit",
            "on_cancel": "On Cancel",
            "on_change": "On Change",
            "on_trash": "On Trash",
            "days_before": "Days Before",
            "days_after": "Days After"
        }
        if event_map.get(event) != self.event:
            return False
        
        # Check condition if set
        if self.condition:
            try:
                context = get_template_context(doc)
                result = frappe.render_template(self.condition, context)
                # Convert string result to boolean
                if isinstance(result, str):
                    result = result.strip().lower() not in ("", "false", "0", "none", "null")
                if not result:
                    return False
            except Exception as e:
                frappe.log_error(
                    "Rule condition error ({}): {}".format(self.rule_name, str(e)),
                    "WhatsApp Rule Condition Error"
                )
                return False
        
        # Check value changed for On Change event
        if self.event == "On Change" and self.value_changed:
            if not doc.has_value_changed(self.value_changed):
                return False
        
        # Check time restrictions
        if not self.is_within_active_hours():
            return False
        
        # Check send once
        if self.send_once:
            if has_sent_for_rule(self.name, doc.doctype, doc.name):
                return False
        
        return True
    
    def is_within_active_hours(self):
        """Check if current time is within active hours"""
        from frappe.utils import now_datetime
        import datetime

        # If active hours restriction is not enabled, allow all times
        if not self.enable_active_hours:
            return True

        # If times aren't set (shouldn't happen if validation passed), allow all times
        if not self.active_hours_start or not self.active_hours_end:
            return True

        try:
            # Parse time strings (format: HH:MM or HH:MM:SS)
            start_parts = self.active_hours_start.split(":")
            end_parts = self.active_hours_end.split(":")

            start = datetime.time(int(start_parts[0]), int(start_parts[1]))
            end = datetime.time(int(end_parts[0]), int(end_parts[1]))
            now = now_datetime().time()

            if start <= end:
                # Normal range (e.g., 09:00 to 18:00)
                return start <= now <= end
            else:
                # Overnight range (e.g., 22:00 to 06:00)
                return now >= start or now <= end
        except (ValueError, IndexError, AttributeError):
            # If parsing fails, allow (don't block notifications due to config error)
            return True

    def get_recipients(self, doc):
        """
        Get recipients for this notification (phone numbers and/or groups)

        Args:
            doc: The source document

        Returns:
            list: List of dicts with type ('phone' or 'group') and value.
                  Child table recipients also include 'row', 'changed_fields',
                  and 'row_before' keys.
        """
        recipients = []

        # Child table path
        if self.use_child_table and self.child_table and self.child_phone_field:
            if self.recipient_type in ("Field Value", "Both", "Phone and Group"):
                child_rows = getattr(doc, self.child_table, []) or []

                # Determine which fields to watch for change detection
                watch_fields = None
                if self.child_watch_fields:
                    watch_fields = [
                        f.strip() for f in self.child_watch_fields.split(",")
                        if f.strip()
                    ]

                # Build (row, changed_fields, prev_row) tuples for all rows
                row_entries = self._build_row_entries(doc, child_rows, watch_fields)

                # Filter to new/changed rows if requested
                # - prev_row is None  → new row  (always include)
                # - changed_fields    → has actual changes (include)
                # - both empty/None   → no change (skip)
                if self.only_changed_rows and self.event in ("On Update", "On Change"):
                    row_entries = [
                        (row, cf, pb) for row, cf, pb in row_entries
                        if pb is None or cf
                    ]

                # Apply per-row Jinja2 condition filter
                if self.row_condition:
                    row_entries = self._filter_by_row_condition(doc, row_entries)

                for row, changed_fields, row_before in row_entries:
                    phone = getattr(row, self.child_phone_field, None)
                    for single_phone in _split_phone_value(phone):
                        recipients.append({
                            "type": "phone",
                            "value": single_phone,
                            "row": row,
                            "changed_fields": changed_fields,
                            "row_before": row_before
                        })
        else:
            # Standard path: get from document field
            if self.recipient_type in ("Field Value", "Both", "Phone and Group") and self.phone_field:
                phone = get_nested_value(doc, self.phone_field)
                for single_phone in _split_phone_value(phone):
                    recipients.append({"type": "phone", "value": single_phone})

        # Get fixed recipients
        if self.recipient_type in ("Fixed Number", "Both") and self.fixed_recipients:
            for phone in self.fixed_recipients.split(","):
                phone = phone.strip()
                if phone:
                    recipients.append({"type": "phone", "value": phone})

        # Get group recipient
        if self.recipient_type in ("Group", "Phone and Group") and self.group_id:
            recipients.append({"type": "group", "value": self.group_id})

        # Remove duplicates while preserving order
        seen = set()
        unique_recipients = []
        for r in recipients:
            key = (r["type"], r["value"])
            if key not in seen:
                seen.add(key)
                unique_recipients.append(r)

        return unique_recipients

    def _build_row_entries(self, doc, child_rows, watch_fields=None):
        """
        Build a list of (row, changed_field_names, prev_row) tuples for all child rows.

        Provides the diff information needed both for filtering (only_changed_rows)
        and for template rendering (changed_fields, previous_values, etc.).

        - New rows:      prev_row = None,    changed_fields = []  (new-row sentinel)
        - Changed rows:  prev_row = old row, changed_fields = [list of names]
        - Unchanged rows:prev_row = old row, changed_fields = []

        NOTE: We compare actual field values, NOT the `modified` timestamp, because
        Frappe refreshes `modified` on every child row on every parent save.

        Args:
            doc: The current document
            child_rows: List of current child table rows
            watch_fields: Optional list of field names to restrict change detection to.
                          None → compare all non-metadata fields.

        Returns:
            list of (row, changed_fields: list[str], prev_row or None)
        """
        previous = doc.get_doc_before_save()
        if not previous:
            # New document — all rows are new
            return [(row, [], None) for row in child_rows]

        prev_rows = getattr(previous, self.child_table, []) or []
        if not prev_rows:
            # No previous rows — all current rows are new
            return [(row, [], None) for row in child_rows]

        prev_by_name = {
            r.name: r for r in prev_rows
            if getattr(r, "name", None)
        }

        result = []
        for row in child_rows:
            row_name = getattr(row, "name", None)
            if not row_name or row_name not in prev_by_name:
                # New row — no prev_row, changed_fields = [] (caller treats None prev as new)
                result.append((row, [], None))
            else:
                prev_row = prev_by_name[row_name]
                changed_fields = _get_changed_field_names(row, prev_row, watch_fields)
                result.append((row, changed_fields, prev_row))

        return result

    def _filter_by_row_condition(self, doc, row_entries):
        """
        Filter row entries by a Jinja2 condition.

        The condition template has access to both `doc` and `row`.
        Only entries where the condition evaluates to truthy are kept.

        Supports:
          - Single expression:  {{ row.field != 0 }}
          - Multi-block OR:     {{ row.field_a != 0 }} || {{ row.field_b != 0 }}
          - Multi-block AND:    {{ row.field_a != 0 }} && {{ row.field_b != 0 }}
          - Jinja if/else:      {% if row.field %}True{% else %}False{% endif %}

        Args:
            doc: The parent document
            row_entries: list of (row, changed_fields, prev_row) tuples

        Returns:
            list: Filtered entries (same tuple format)
        """
        filtered = []
        for row, changed_fields, prev_row in row_entries:
            try:
                context = get_template_context(doc)
                context["row"] = row
                rendered = frappe.render_template(self.row_condition, context)
                if _evaluate_condition_result(rendered):
                    filtered.append((row, changed_fields, prev_row))
            except Exception as e:
                frappe.log_error(
                    "Row condition error (rule: {}, row {}): {}".format(
                        self.name, getattr(row, "idx", "?"), str(e)
                    ),
                    "WhatsApp Row Condition Error"
                )
        return filtered

    def render_message(self, doc, for_owner=False, row=None, changed_fields=None, row_before=None):
        """
        Render the message template with document context

        Args:
            doc: The source document
            for_owner: If True, use owner template
            row: Optional child table row for per-row rendering
            changed_fields: list[str] of field names that changed in this save (child table only)
            row_before: Previous state of the child row (for showing old values)

        Returns:
            str: Rendered message

        Template context extras (when changed_fields is provided):
            changed_fields   — list of field names that changed, e.g. ["valor_fotos", "valor_cracha"]
            changed_values   — dict of {field: new_value} for each changed field
            previous_values  — dict of {field: old_value} for each changed field
            row_before       — the full previous row object (or None for new rows)
        """
        template = self.owner_message_template if for_owner and self.owner_message_template else self.message_template

        try:
            context = get_template_context(doc)
            if row is not None:
                context["row"] = row

            # Always inject diff variables so templates can reference them safely
            cf = changed_fields if changed_fields is not None else []
            context["changed_fields"] = cf
            context["changed_values"] = {
                f: getattr(row, f, None) for f in cf
            } if row is not None else {}
            context["previous_values"] = {
                f: getattr(row_before, f, None) for f in cf
            } if row_before is not None else {}
            context["row_before"] = row_before

            return frappe.render_template(template, context)
        except Exception as e:
            frappe.log_error(
                "Template render error ({}): {}".format(self.rule_name, str(e)),
                "WhatsApp Template Error"
            )
            return None


def _split_phone_value(phone):
    """
    Split a phone field value that may contain multiple numbers.

    Handles the common pattern where a single field stores several numbers
    separated by '/', ',', or ';' — e.g. "841234567/871234567".

    Args:
        phone: Raw phone field value (string, int, or None)

    Returns:
        list[str]: Individual phone number strings (non-empty, stripped)
    """
    if not phone:
        return []
    # Normalise separators then split
    raw = str(phone).replace(",", "/").replace(";", "/")
    return [p.strip() for p in raw.split("/") if p.strip()]


# Fields that carry no user data — skip when comparing child row changes
_CHILD_ROW_META_FIELDS = frozenset({
    "name", "idx", "modified", "creation", "modified_by", "owner",
    "docstatus", "parent", "parentfield", "parenttype", "doctype"
})


def _get_changed_field_names(current_row, prev_row, watch_fields=None):
    """
    Return the list of data field names that differ between current_row and prev_row.

    Args:
        current_row:  Post-save child row (Document or frappe._dict)
        prev_row:     Pre-save child row (from get_doc_before_save())
        watch_fields: Optional list of field names to restrict to.
                      None / empty → check all non-metadata fields.

    Skips metadata fields (name, modified, parent, …) because Frappe
    refreshes those on every save regardless of actual data changes.
    Treats None and empty-string as equivalent to avoid false positives.

    Returns:
        list[str]: Field names whose values changed
    """
    current_dict = (
        current_row.as_dict()
        if hasattr(current_row, "as_dict")
        else dict(current_row)
    )

    changed = []
    for key, new_val in current_dict.items():
        if key in _CHILD_ROW_META_FIELDS:
            continue
        if watch_fields and key not in watch_fields:
            continue

        old_val = getattr(prev_row, key, None)

        # Normalise: treat None and "" as the same value
        if new_val == "" or new_val is None:
            new_val = None
        if old_val == "" or old_val is None:
            old_val = None

        if new_val != old_val:
            changed.append(key)

    return changed


def _child_row_has_changed(current_row, prev_row, watch_fields=None):
    """Return True if any (watched) data field changed. Uses _get_changed_field_names."""
    return bool(_get_changed_field_names(current_row, prev_row, watch_fields))


def _evaluate_condition_result(rendered):
    """
    Evaluate the string rendered from a Jinja2 condition template.

    Handles the common patterns:

    1. Single expression  — {{ row.field != 0 }}
       Renders to "True" or "False".

    2. Multi-block OR     — {{ row.a != 0 }} || {{ row.b != 0 }}
       Renders to e.g. "True || False || False || " (trailing separator OK).
       Returns True if ANY segment is truthy.

    3. Multi-block AND    — {{ row.a != 0 }} && {{ row.b != 0 }}
       Returns True only if ALL segments are truthy.

    4. if/else block      — {% if ... %}True{% else %}False{% endif %}
       Renders to "True" or "False" — handled by case 1.

    Args:
        rendered: str — output of frappe.render_template()

    Returns:
        bool
    """
    _FALSY = {"", "false", "0", "none", "null", "no"}
    _TRUTHY = {"true", "1", "yes"}

    s = (rendered or "").strip()

    if not s:
        return False

    # Multi-block OR  (user wrote {{ expr }} || {{ expr }})
    if "||" in s:
        parts = s.split("||")
        return any(p.strip().lower() in _TRUTHY for p in parts)

    # Multi-block AND (user wrote {{ expr }} && {{ expr }})
    if "&&" in s:
        parts = s.split("&&")
        # Ignore empty segments (e.g. trailing &&)
        non_empty = [p.strip().lower() for p in parts if p.strip()]
        return bool(non_empty) and all(p in _TRUTHY for p in non_empty)

    # Single value
    lower = s.lower()
    if lower in _TRUTHY:
        return True
    if lower in _FALSY:
        return False

    # Any other non-empty string (e.g. a rendered number like "42") → truthy
    return True


def get_template_context(doc):
    """
    Build context for Jinja2 template rendering
    
    Args:
        doc: The source document
    
    Returns:
        dict: Template context
    """
    return {
        "doc": doc,
        "frappe": frappe,
        "nowdate": frappe.utils.nowdate,
        "nowtime": frappe.utils.nowtime,
        "now_datetime": frappe.utils.now_datetime,
        "format_date": frappe.utils.formatdate,
        "format_datetime": frappe.utils.format_datetime,
        "format_currency": frappe.utils.fmt_money,
        "flt": frappe.utils.flt,
        "cint": frappe.utils.cint,
        "cstr": frappe.utils.cstr,
        "get_url": frappe.utils.get_url,
        "_": _
    }


def get_nested_value(doc, field_path):
    """
    Get value from document, supporting nested fields like 'customer.mobile_no'
    or child table fields like 'items[0].item_code'
    
    Args:
        doc: The document
        field_path: Dot-notation field path
    
    Returns:
        The field value or None
    """
    if not field_path:
        return None
    
    parts = field_path.split(".")
    value = doc
    
    for part in parts:
        if value is None:
            return None
        
        # Handle array notation like items[0]
        if "[" in part:
            field_name, index = part.split("[")
            index = int(index.rstrip("]"))
            value = getattr(value, field_name, None)
            if value and isinstance(value, (list, tuple)) and len(value) > index:
                value = value[index]
            else:
                return None
        else:
            value = getattr(value, part, None) if hasattr(value, part) else value.get(part) if isinstance(value, dict) else None
    
    return value


def get_rules_for_doctype(doctype, event):
    """
    Get all applicable rules for a doctype and event
    
    Args:
        doctype: The DocType name
        event: The event type
    
    Returns:
        list: List of WhatsApp Notification Rule documents
    """
    cache_key = "whatsapp_rules_{}_{}".format(doctype, event)
    rules = frappe.cache().get_value(cache_key)
    
    if rules is None:
        event_map = {
            "after_insert": "After Insert",
            "on_update": "On Update",
            "on_submit": "On Submit",
            "on_cancel": "On Cancel",
            "on_change": "On Change",
            "on_trash": "On Trash"
        }
        
        rules = frappe.get_all(
            "WhatsApp Notification Rule",
            filters={
                "enabled": 1,
                "document_type": doctype,
                "event": event_map.get(event, event)
            },
            pluck="name"
        )
        
        frappe.cache().set_value(cache_key, rules, expires_in_sec=60)
    
    return [frappe.get_doc("WhatsApp Notification Rule", r) for r in rules]


def has_sent_for_rule(rule_name, doctype, docname):
    """
    Check if this rule has already sent for this document
    
    Args:
        rule_name: The notification rule name
        doctype: The document type
        docname: The document name
    
    Returns:
        bool: True if already sent
    """
    return frappe.db.exists("WhatsApp Message Log", {
        "notification_rule": rule_name,
        "reference_doctype": doctype,
        "reference_name": docname,
        "status": ["in", ["Sent", "Pending"]]
    })


def clear_rules_cache():
    """Clear all cached rules"""
    # This is called when rules are modified
    frappe.cache().delete_keys("whatsapp_rules_*")


@frappe.whitelist()
def get_doctype_fields(doctype):
    """
    Get fields from a DocType for field selection
    
    Args:
        doctype: The DocType name
    
    Returns:
        list: List of field options
    """
    if not doctype:
        return []
    
    meta = frappe.get_meta(doctype)
    fields = []
    
    for df in meta.fields:
        if df.fieldtype in ("Data", "Phone", "Int", "Link", "Dynamic Link"):
            fields.append({
                "value": df.fieldname,
                "label": "{} ({})".format(df.label or df.fieldname, df.fieldtype)
            })
    
    # Add linked document fields
    for df in meta.fields:
        if df.fieldtype == "Link" and df.options:
            try:
                linked_meta = frappe.get_meta(df.options)
                for ldf in linked_meta.fields:
                    if ldf.fieldtype in ("Data", "Phone", "Int"):
                        fields.append({
                            "value": "{}.{}".format(df.fieldname, ldf.fieldname),
                            "label": "{} > {} ({})".format(df.label, ldf.label or ldf.fieldname, ldf.fieldtype)
                        })
            except Exception:
                pass
    
    return fields


@frappe.whitelist()
def preview_message(rule_name, docname):
    """
    Preview a message for a specific document

    Args:
        rule_name: The notification rule name
        docname: The document to use for preview

    Returns:
        dict: Preview data including rendered message(s)
    """
    rule = frappe.get_doc("WhatsApp Notification Rule", rule_name)
    doc = frappe.get_doc(rule.document_type, docname)

    recipients = rule.get_recipients(doc)

    # Format recipients for display
    formatted_recipients = []
    for r in recipients:
        if isinstance(r, dict):
            if r["type"] == "group":
                group_name = rule.group_name or r["value"]
                formatted_recipients.append("{} (Group)".format(group_name))
            else:
                formatted_recipients.append(r["value"])
        else:
            formatted_recipients.append(r)

    # Child table: render per-row previews
    if rule.use_child_table and rule.child_table:
        row_previews = []
        for r in recipients[:5]:  # Max 5 previews
            row = r.get("row") if isinstance(r, dict) else None
            msg = rule.render_message(doc, row=row)
            row_previews.append({
                "phone": r.get("value", "") if isinstance(r, dict) else r,
                "message": msg
            })
        return {
            "message": row_previews[0]["message"] if row_previews else rule.render_message(doc),
            "recipients": formatted_recipients,
            "row_previews": row_previews,
            "doctype": rule.document_type,
            "docname": docname
        }

    message = rule.render_message(doc)
    return {
        "message": message,
        "recipients": formatted_recipients,
        "doctype": rule.document_type,
        "docname": docname
    }


@frappe.whitelist()
def get_child_tables(doctype):
    """
    Get Table-type fields from a DocType (for child table selection)

    Args:
        doctype: The DocType name

    Returns:
        list: List of dicts with fieldname, label, and options (child DocType)
    """
    if not doctype:
        return []

    meta = frappe.get_meta(doctype)
    tables = []
    for df in meta.fields:
        if df.fieldtype == "Table":
            tables.append({
                "fieldname": df.fieldname,
                "label": df.label or df.fieldname,
                "options": df.options  # The child DocType name
            })
    return tables


@frappe.whitelist()
def get_doctype_date_fields(doctype):
    """
    Get Date and Datetime fields from a DocType (for Days Before/After event)

    Args:
        doctype: The DocType name

    Returns:
        list: List of dicts with fieldname and label
    """
    if not doctype:
        return []

    meta = frappe.get_meta(doctype)
    fields = []
    for df in meta.fields:
        if df.fieldtype in ("Date", "Datetime"):
            fields.append({
                "fieldname": df.fieldname,
                "label": "{} ({})".format(df.label or df.fieldname, df.fieldtype)
            })
    return fields


@frappe.whitelist()
def get_child_table_fields(doctype, child_table_field):
    """
    Get Data/Phone/Int fields from a child table's DocType

    Args:
        doctype: The parent DocType name
        child_table_field: The fieldname of the Table field

    Returns:
        list: List of dicts with fieldname and label
    """
    if not doctype or not child_table_field:
        return []

    meta = frappe.get_meta(doctype)
    table_field = meta.get_field(child_table_field)
    if not table_field or not table_field.options:
        return []

    child_meta = frappe.get_meta(table_field.options)
    fields = []
    for df in child_meta.fields:
        if df.fieldtype in ("Data", "Phone", "Int", "Link"):
            fields.append({
                "fieldname": df.fieldname,
                "label": "{} ({})".format(df.label or df.fieldname, df.fieldtype)
            })
    return fields
