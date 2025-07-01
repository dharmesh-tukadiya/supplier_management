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
		// Fix: Use the proper method to get selected rows
		let selected_rows = [];
		
		if (frappe.query_report.datatable) {
			const checked_rows = frappe.query_report.datatable.rowmanager.getCheckedRows();
			selected_rows = checked_rows.map((i) => frappe.query_report.data[i]);
		}

		if (!selected_rows.length) {
			frappe.throw({
				message: __("Please select rows to create Material Request"),
				title: __("No Items Selected"),
				indicator: "blue",
			});
		}

		// Using the exact Sales Order pattern for creating Material Request
		frappe.new_doc("Material Request", {
			material_request_type: "Purchase",
			items: selected_rows.map((row) => ({
				item_code: row.item_code,
				warehouse: row.warehouse,
				qty: Math.abs(row.projected_qty),
				schedule_date: frappe.datetime.add_days(frappe.datetime.get_today(), 7),
			})),
		});
	},

	make_purchase_order(report) {
		// Fix: Use the proper method to get selected rows
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

		// Using exact Sales Order dialog pattern
		var dialog = new frappe.ui.Dialog({
			title: __("Select Items"),
			size: "large",
			fields: [
				{
					fieldtype: "Check",
					label: __("Against Default Supplier"),
					fieldname: "against_default_supplier",
					default: 0,
				},
				{
					fieldname: "items_for_po",
					fieldtype: "Table",
					label: __("Select Items"),
					fields: [
						{
							fieldtype: "Data",
							fieldname: "item_code",
							label: __("Item"),
							read_only: 1,
							in_list_view: 1,
						},
						{
							fieldtype: "Data",
							fieldname: "warehouse",
							label: __("Warehouse"),
							read_only: 1,
							in_list_view: 1,
						},
						{
							fieldtype: "Float",
							fieldname: "pending_qty",
							label: __("Required Qty"),
							read_only: 1,
							in_list_view: 1,
						},
						{
							fieldtype: "Data",
							fieldname: "projected_qty",
							label: __("Projected Qty"),
							read_only: 1,
							in_list_view: 1,
						},
					],
					data: selected_rows.map((row) => ({
						item_code: row.item_code,
						warehouse: row.warehouse,
						pending_qty: Math.abs(row.projected_qty),
						projected_qty: row.projected_qty,
					})),
					cannot_add_rows: true,
					cannot_delete_rows: true,
				},
			],
			primary_action_label: __("Create Purchase Order"),
			primary_action(args) {
				if (!args) return;

				let selected_items = dialog.fields_dict.items_for_po.grid.get_selected_children();
				if (selected_items.length == 0) {
					frappe.throw({
						message: __("Please select Items from the Table"),
						title: __("Items Required"),
						indicator: "blue",
					});
				}

				dialog.hide();

				// Create Purchase Order directly (simplified from Sales Order pattern)
				frappe.new_doc("Purchase Order", {
					items: selected_items.map((item) => ({
						item_code: item.item_code,
						warehouse: item.warehouse,
						qty: item.pending_qty,
						schedule_date: frappe.datetime.add_days(frappe.datetime.get_today(), 7),
					})),
				});
			},
		});

		dialog.show();
	},
};