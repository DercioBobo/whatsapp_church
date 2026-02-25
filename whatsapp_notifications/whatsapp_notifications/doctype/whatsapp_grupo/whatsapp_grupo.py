import frappe
from frappe import _
from frappe.model.document import Document


class WhatsAppGrupo(Document):

    @frappe.whitelist()
    def update_members(self):
        """Re-collect phone numbers from the source doc and add to the group."""
        if not self.grupo_id:
            frappe.throw(_("Grupo ainda não criado no WhatsApp."))
        if not self.source_doctype or not self.source_docname:
            frappe.throw(_("Documento de origem não configurado."))

        from whatsapp_notifications.whatsapp_notifications.api import (
            collect_phones_for_group,
            whatsapp_group_add_participants,
        )

        phones = collect_phones_for_group(self.source_doctype, self.source_docname)
        if not phones:
            frappe.throw(_("Nenhum telefone encontrado no documento de origem."))

        result = whatsapp_group_add_participants(self.grupo_id, phones)
        if result.get("success"):
            self.member_count = len(phones)
            self.last_synced = frappe.utils.now_datetime()
            self.save(ignore_permissions=True)
            frappe.db.commit()
            return {"success": True, "count": len(phones)}
        return result
