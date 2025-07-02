// Copyright (c) 2013, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.query_reports["Items Needed"] = {
	filters: [
		{
			fieldname: "item_code",
			label: __("Item"),
			fieldtype: "Link",
			options: "Item",
		},
		{
			fieldname: "warehouse",
			label: __("Warehouse"),
			fieldtype: "Link",
			options: "Warehouse",
		},
		{
			fieldname: "supplier",
			label: __("Supplier"),
			fieldtype: "Link",
			options: "Supplier",
		},
	],

	columns: [
		{
			label: __("Item"),
			fieldname: "item_code",
			fieldtype: "Link",
			options: "Item",
			width: 120,
		},
		{
			label: __("Warehouse"),
			fieldname: "warehouse",
			fieldtype: "Link",
			options: "Warehouse",
			width: 120,
		},
		{
			label: __("Supplier"),
			fieldname: "supplier",
			fieldtype: "Link",
			options: "Supplier",
			width: 120,
		},
		{
			label: __("Actual"),
			fieldname: "actual_qty",
			fieldtype: "Float",
			width: 90,
		},
		{
			label: __("Requested"),
			fieldname: "indented_qty",
			fieldtype: "Float",
			width: 90,
		},
		{
			label: __("Reserved"),
			fieldname: "reserved_qty",
			fieldtype: "Float",
			width: 90,
		},
		{
			label: __("Ordered"),
			fieldname: "ordered_qty",
			fieldtype: "Float",
			width: 90,
		},
		{
			label: __("Projected"),
			fieldname: "projected_qty",
			fieldtype: "Float",
			width: 90,
		},
	],

	formatter(value, row, column, data, default_formatter) {
		value = default_formatter(value, row, column, data);

		// Highlight negative projected qty in red
		if (column.fieldname === "projected_qty" && data.projected_qty < 0) {
			value = `<span style="color:red; font-weight: bold;">${value}</span>`;
		}

		return value;
	},

	get_datatable_options(options) {
		return Object.assign(options, {
			checkboxColumn: true,
			// inlineFilters: true,
			// showTotalRow: true
		});
	},

	onload(report) {
		// Material Request Button - Using exact Sales Order pattern
		report.page.add_inner_button(__("Material Request"), () => {
			this.make_material_request(report);
		}, __("Create"));

		// Purchase Order Button - Using exact Sales Order pattern  
		report.page.add_inner_button(__("Purchase Order"), () => {
			this.make_purchase_order(report);
		}, __("Create"));

		// Set Create as primary button group
		report.page.set_inner_btn_group_as_primary(__("Create"));
	},

	make_material_request(report) {
		let selected_rows = [];

		// Get selected rows from the datatable
		if (frappe.query_report.datatable) {
			const checked_rows = frappe.query_report.datatable.rowmanager.getCheckedRows();
			selected_rows = checked_rows.map(i => frappe.query_report.data[i]);
		}

		// Validate selected rows
		if (!selected_rows.length) {
			frappe.throw({
				message: __("Please select rows to create Material Request"),
				title: __("No Items Selected"),
				indicator: "blue",
			});
		}

		// Filter valid rows
		const valid_rows = selected_rows.filter(row => {
			if (!row.item_code) return false;
			if (!row.projected_qty || isNaN(row.projected_qty)) return false;
			return true;
		});

		if (!valid_rows.length) {
			frappe.throw(__("No valid items to create Material Request."));
		}

		// Create a new Material Request document
		frappe.model.with_doctype("Material Request", () => {
			const doc = frappe.model.get_new_doc("Material Request");
			doc.material_request_type = "Purchase";
			doc.schedule_date = frappe.datetime.add_days(frappe.datetime.get_today(), 7);

			// Add valid rows as child items
			valid_rows.forEach(row => {
				const item = frappe.model.add_child(doc, "items");
				item.item_code = row.item_code;
				item.qty = Math.abs(row.projected_qty);
				item.warehouse = row.warehouse;
				item.schedule_date = frappe.datetime.add_days(frappe.datetime.get_today(), 7);

				// Fetch additional item details to auto-populate UOM
				frappe.call({
					method: "erpnext.stock.get_item_details.get_item_details",
					args: {
						args: {
							item_code: item.item_code,
							warehouse: item.warehouse,
							doctype: doc.doctype,
							company: doc.company,
							qty: item.qty,
						},
					},
					callback: function (r) {
						if (!r.exc && r.message) {
							item.uom = r.message.uom; // Set UOM from item master
							item.stock_uom = r.message.stock_uom; // Set stock UOM
							item.conversion_factor = r.message.conversion_factor; // Set conversion factor
							item.item_name = r.message.item_name; // Set item name
							refresh_field("items");
						}
					},
				});
			});

			// Navigate to the new Material Request form
			frappe.set_route("Form", "Material Request", doc.name).then(() => {
				// Refresh the form to show the added items
				cur_frm.refresh_fields();
			});
		});
	},

	make_purchase_order(report) {
		// Get selected rows
		let selected_rows = [];

		if (frappe.query_report.datatable) {
			const checked_rows = frappe.query_report.datatable.rowmanager.getCheckedRows();
			selected_rows = checked_rows.map((i) => frappe.query_report.data[i]);
		}

		if (!selected_rows.length) {
			frappe.throw({
				message: __("Please select rows to create Purchase Order"),
				title: __("No Items Selected"),
				indicator: "blue",
			});
		}

		// Filter valid rows
		const valid_rows = selected_rows.filter((row) => {
			if (!row.item_code) return false;
			if (!row.projected_qty || isNaN(row.projected_qty)) return false;
			return true;
		});

		if (!valid_rows.length) {
			frappe.throw(__("No valid items to create Purchase Order."));
		}

		// Create a new Purchase Order document
		frappe.model.with_doctype("Purchase Order", () => {
			const doc = frappe.model.get_new_doc("Purchase Order");

			// Add valid rows as child items
			valid_rows.forEach((row) => {
				const item = frappe.model.add_child(doc, "items");
				item.item_code = row.item_code;
				item.qty = Math.abs(row.projected_qty);
				item.warehouse = row.warehouse;
				item.schedule_date = frappe.datetime.add_days(frappe.datetime.get_today(), 7);

				// Fetch additional item details to auto-populate UOM and other fields
				frappe.call({
					method: "erpnext.stock.get_item_details.get_item_details",
					args: {
						args: {
							item_code: item.item_code,
							warehouse: item.warehouse,
							doctype: doc.doctype,
							company: doc.company,
							qty: item.qty,
						},
					},
					callback: function (r) {
						if (!r.exc && r.message) {
							item.uom = r.message.uom; // Set UOM from item master
							item.stock_uom = r.message.stock_uom; // Set stock UOM
							item.conversion_factor = r.message.conversion_factor; // Set conversion factor
							item.item_name = r.message.item_name; // Set item name
							refresh_field("items");
						}
					},
				});
			});

			// Navigate to the new Purchase Order form
			frappe.set_route("Form", "Purchase Order", doc.name).then(() => {
				// Refresh the form to show the added items
				cur_frm.refresh_fields();
			});
		});
	},
};