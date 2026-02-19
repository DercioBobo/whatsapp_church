"""
WhatsApp Birthday Rule - Sends birthday notifications from any DocType
"""
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime, getdate, get_datetime, today


class WhatsAppBirthdayRule(Document):

    def validate(self):
        self.validate_document_type()
        self.validate_fields()
        self.validate_templates()

    def validate_document_type(self):
        if self.document_type and not frappe.db.exists("DocType", self.document_type):
            frappe.throw(_("Document Type '{}' does not exist").format(self.document_type))

    def validate_fields(self):
        if not self.document_type:
            return
        meta = frappe.get_meta(self.document_type)
        if self.birthdate_field and not meta.has_field(self.birthdate_field):
            frappe.throw(
                _("Field '{}' not found in {}").format(self.birthdate_field, self.document_type)
            )
        if self.phone_field and not meta.has_field(self.phone_field):
            frappe.msgprint(
                _("Warning: Phone field '{}' not found in {}").format(
                    self.phone_field, self.document_type
                ),
                indicator="orange"
            )

    def validate_templates(self):
        dummy_doc = frappe._dict({"name": "TEST"})
        dummy_context = {
            "doc": dummy_doc,
            "age": 0,
            "days_until": 0,
            "birthday_date": today(),
            "frappe": frappe
        }
        templates = []
        if self.send_to_person and self.person_message:
            templates.append((_("Person Message"), self.person_message))
        if self.send_to_group and self.group_message:
            templates.append((_("Group Message"), self.group_message))
        if self.send_to_additional and self.additional_message:
            templates.append((_("Additional Message"), self.additional_message))

        for label, template in templates:
            try:
                frappe.render_template(template, dummy_context)
            except (frappe.DoesNotExistError, frappe.ValidationError):
                pass
            except Exception as e:
                frappe.throw(_("Invalid {}: {}").format(label, str(e)))

    def is_time_to_send(self):
        """Check if it's time to send (within 30-minute window after send_time)"""
        if not self.send_time:
            return False
        now = now_datetime()
        send_time = get_datetime("{} {}".format(today(), self.send_time))
        diff_minutes = (now - send_time).total_seconds() / 60
        return 0 <= diff_minutes <= 30

    def was_run_today(self):
        """Check if this rule already ran today"""
        if not self.last_run:
            return False
        return getdate(self.last_run) == getdate(today())

    def process(self, test_date=None):
        """
        Find birthday matches for target_date, send messages, update status.
        target_date = today + days_before (the birthday we're looking for).
        """
        if test_date:
            target_date = getdate(test_date)
        else:
            from frappe.utils import add_days
            target_date = getdate(add_days(today(), self.days_before))

        sent_count = 0
        errors = []

        try:
            matches = self.get_birthday_matches(target_date)

            for doc in matches:
                try:
                    if self.check_duplicate(doc.name):
                        continue
                    self._send_for_doc(doc, target_date)
                    sent_count += 1
                except Exception as e:
                    errors.append("{}: {}".format(doc.name, str(e)))
                    frappe.log_error(
                        "Error sending birthday for {}/{}: {}".format(
                            self.document_type, doc.name, str(e)
                        ),
                        "WhatsApp Birthday Rule Error"
                    )

            self.db_set("last_run", now_datetime())
            self.db_set("last_count", sent_count)

            if errors:
                self.db_set("last_status", "Conclu\u00eddo com erros ({} enviados)".format(sent_count))
                self.db_set("last_error", "\n".join(errors[:5]))
            else:
                self.db_set("last_status", "Enviado para {} destinat\u00e1rios".format(sent_count))
                self.db_set("last_error", None)

            frappe.db.commit()

        except Exception as e:
            self.db_set("last_status", "Erro")
            self.db_set("last_error", str(e)[:500])
            frappe.db.commit()
            frappe.log_error(
                "Birthday rule {} failed: {}".format(self.name, str(e)),
                "WhatsApp Birthday Rule Error"
            )
            raise

        return {"sent": sent_count, "errors": errors, "total_matches": len(matches) if 'matches' in dir() else 0}

    def get_birthday_matches(self, target_date):
        """
        Query documents whose birthdate_field matches month+day of target_date.
        Applies optional filter_field/operator/value.
        Returns list of frappe Document objects.
        """
        if not self.birthdate_field or not self.document_type:
            return []

        if isinstance(target_date, str):
            target_date = getdate(target_date)

        month = target_date.month
        day = target_date.day
        table_name = "tab{}".format(self.document_type)

        # Build parameterized query
        conditions = "MONTH(`{field}`) = %(month)s AND DAY(`{field}`) = %(day)s".format(
            field=self.birthdate_field
        )
        params = {"month": month, "day": day}

        # Optional extra filter
        if self.filter_field and self.filter_operator:
            op = self.filter_operator
            if op == "is set":
                conditions += " AND (`{f}` IS NOT NULL AND `{f}` != '')".format(f=self.filter_field)
            elif op == "is not set":
                conditions += " AND (`{f}` IS NULL OR `{f}` = '')".format(f=self.filter_field)
            elif self.filter_value is not None and self.filter_value != "":
                op_map = {"=": "=", "!=": "!=", ">": ">", "<": "<", "like": "LIKE"}
                sql_op = op_map.get(op, "=")
                conditions += " AND `{f}` {op} %(filter_value)s".format(
                    f=self.filter_field, op=sql_op
                )
                params["filter_value"] = self.filter_value

        rows = frappe.db.sql(
            "SELECT `name` FROM `{table}` WHERE {cond} AND `docstatus` < 2".format(
                table=table_name,
                cond=conditions
            ),
            params,
            as_dict=False
        )

        return [frappe.get_doc(self.document_type, row[0]) for row in rows]

    def _build_context(self, doc, target_date):
        """Build Jinja2 context with birthday-specific variables"""
        from whatsapp_notifications.whatsapp_notifications.doctype.whatsapp_notification_rule.whatsapp_notification_rule import get_template_context

        if isinstance(target_date, str):
            target_date = getdate(target_date)

        context = get_template_context(doc)

        # Calculate age
        age = 0
        if self.birthdate_field:
            birthdate = getattr(doc, self.birthdate_field, None)
            if birthdate:
                if isinstance(birthdate, str):
                    birthdate = getdate(birthdate)
                try:
                    age = target_date.year - birthdate.year
                except Exception:
                    age = 0

        context.update({
            "age": age,
            "days_until": self.days_before,
            "birthday_date": target_date,
        })

        return context

    def _send_for_doc(self, doc, target_date):
        """Send all applicable messages for a single document"""
        from whatsapp_notifications.whatsapp_notifications.api import send_whatsapp_notification

        context = self._build_context(doc, target_date)

        # Send to the birthday person
        if self.send_to_person and self.phone_field and self.person_message:
            phone = getattr(doc, self.phone_field, None)
            if phone:
                msg = frappe.render_template(self.person_message, context)
                send_whatsapp_notification(
                    phone=str(phone),
                    message=msg,
                    reference_doctype=self.document_type,
                    reference_name=doc.name,
                    notification_rule=self.name
                )

        # Send to group
        if self.send_to_group and self.group_id and self.group_message:
            msg = frappe.render_template(self.group_message, context)
            send_whatsapp_notification(
                phone=self.group_id,
                message=msg,
                reference_doctype=self.document_type,
                reference_name=doc.name,
                notification_rule=self.name
            )

        # Send to additional recipients
        if self.send_to_additional and self.additional_message:
            msg = frappe.render_template(self.additional_message, context)
            for recipient in self.additional_recipients:
                send_whatsapp_notification(
                    phone=recipient.phone,
                    message=msg,
                    reference_doctype=self.document_type,
                    reference_name=doc.name,
                    notification_rule=self.name
                )

    def check_duplicate(self, docname):
        """Return True if a notification was already sent today for this doc via this rule"""
        result = frappe.db.sql(
            """
            SELECT name FROM `tabWhatsApp Message Log`
            WHERE notification_rule = %s
              AND reference_name = %s
              AND DATE(creation) = CURDATE()
            LIMIT 1
            """,
            (self.name, docname)
        )
        return bool(result)

    @frappe.whitelist()
    def run_now(self):
        """Trigger process() immediately and return summary"""
        result = self.process()
        return {
            "success": True,
            "sent": result.get("sent", 0),
            "errors": result.get("errors", []),
            "total_matches": result.get("total_matches", 0)
        }

    @frappe.whitelist()
    def preview_for_document(self, docname):
        """Render messages for a specific document, return preview dict"""
        from frappe.utils import add_days
        doc = frappe.get_doc(self.document_type, docname)
        target_date = getdate(add_days(today(), self.days_before))
        context = self._build_context(doc, target_date)

        preview = {
            "docname": docname,
            "age": context.get("age"),
            "birthday_date": str(context.get("birthday_date")),
            "days_until": self.days_before,
        }

        if self.send_to_person and self.person_message:
            try:
                preview["person_message"] = frappe.render_template(self.person_message, context)
                if self.phone_field:
                    preview["person_phone"] = str(getattr(doc, self.phone_field, "") or "")
            except Exception as e:
                preview["person_message"] = "Erro: {}".format(str(e))

        if self.send_to_group and self.group_message:
            try:
                preview["group_message"] = frappe.render_template(self.group_message, context)
                preview["group_id"] = self.group_id
            except Exception as e:
                preview["group_message"] = "Erro: {}".format(str(e))

        if self.send_to_additional and self.additional_message:
            try:
                preview["additional_message"] = frappe.render_template(self.additional_message, context)
                preview["additional_count"] = len(self.additional_recipients)
            except Exception as e:
                preview["additional_message"] = "Erro: {}".format(str(e))

        return preview


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_birthday_doctype_fields(doctype):
    """
    Return categorised field lists for the birthday rule form.
    Called from JS when document_type changes.
    """
    if not doctype:
        return {}

    meta = frappe.get_meta(doctype)

    date_fields = []
    phone_fields = []
    data_fields = []
    all_fields = []

    for df in meta.fields:
        if df.fieldtype in ("Section Break", "Column Break", "HTML", "Button", "Table",
                            "Fold", "Heading", "Tab Break"):
            continue

        entry = {
            "fieldname": df.fieldname,
            "label": "{} ({})".format(df.label or df.fieldname, df.fieldtype)
        }

        all_fields.append(entry)

        if df.fieldtype in ("Date", "Datetime"):
            date_fields.append(entry)
        if df.fieldtype in ("Data", "Phone"):
            phone_fields.append(entry)
        if df.fieldtype == "Data":
            data_fields.append(entry)

    return {
        "date_fields": date_fields,
        "phone_fields": phone_fields,
        "data_fields": data_fields,
        "all_fields": all_fields
    }


def process_birthday_rule(rule_name):
    """Enqueue target: process a specific birthday rule (called via frappe.enqueue)"""
    rule = frappe.get_doc("WhatsApp Birthday Rule", rule_name)
    rule.process()
