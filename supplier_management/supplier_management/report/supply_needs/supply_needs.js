// Copyright (c) 2013, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.query_reports["Supply Needs"] = {
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

	page_length: 50,
	current_page: 1,
	total_count: 0,
	sort_field: null,
	sort_order: "none",

	projectedQtyIndex: 13,
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
			cellHeight: 64,
			dynamicRowHeight: false,
		});
	},

	after_datatable_render(datatable) {
		this.patch_datatable_sorting(datatable);
		this.disable_image_column_controls(datatable);
		this.update_pagination();
		this.set_table_height(datatable);
	},

	onload(report) {
		this.report = report;
		this.inject_styles();
		this.patch_report_pagination(report);

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

	inject_styles() {
		if (document.getElementById("supply-needs-report-styles")) return;

		const style = document.createElement("style");
		style.id = "supply-needs-report-styles";
		style.textContent = `
			[data-route="query-report/Supply Needs"] .supply-needs-pagination {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 16px;
				width: 100%;
				min-height: 36px;
				margin-bottom: 8px;
			}
			[data-route="query-report/Supply Needs"] .supply-needs-row-count {
				display: inline-flex;
				align-items: center;
				white-space: nowrap;
				font-weight: 500;
			}
			[data-route="query-report/Supply Needs"] .supply-needs-page-size,
			[data-route="query-report/Supply Needs"] .supply-needs-page-buttons {
				display: inline-flex;
				align-items: center;
				gap: 6px;
			}
			[data-route="query-report/Supply Needs"] .supply-needs-page-size select {
				width: 72px;
				height: 26px;
				padding-top: 2px;
				padding-bottom: 2px;
			}
			[data-route="query-report/Supply Needs"] .supply-needs-page-status {
				min-width: 170px;
				text-align: center;
			}
			[data-route="query-report/Supply Needs"] .datatable {
				border: 1px solid var(--border-color);
				border-radius: 6px;
				overflow: hidden;
			}
			[data-route="query-report/Supply Needs"] .datatable .dt-scrollable {
				min-height: 420px;
				max-height: calc(100vh - 260px);
			}
			[data-route="query-report/Supply Needs"] .datatable .dt-cell__content img {
				max-width: 56px !important;
				max-height: 56px !important;
				object-fit: cover;
				border-radius: 4px;
			}
			[data-route="query-report/Supply Needs"] .datatable .dt-header {
				background: var(--subtle-accent);
			}
			[data-route="query-report/Supply Needs"] .datatable .dt-cell--header .dt-cell__content {
				font-weight: 600;
			}
			[data-route="query-report/Supply Needs"] .datatable .dt-row-filter .dt-cell {
				height: 35px;
			}
			[data-route="query-report/Supply Needs"] .datatable .dt-filter:disabled {
				background: var(--disabled-control-bg);
				cursor: not-allowed;
			}
		`;
		document.head.appendChild(style);
	},

	patch_report_pagination(report) {
		if (report.supply_needs_pagination_patched) return;

		report.supply_needs_pagination_patched = true;
		const original_get_filter_values = report.get_filter_values.bind(report);
		const original_prepare_report_data = report.prepare_report_data.bind(report);
		const original_show_footer_message = report.show_footer_message.bind(report);

		report.get_filter_values = (...args) => {
			const filters = original_get_filter_values(...args) || {};
			const report_filter_signature = JSON.stringify(filters);

			if (
				this.last_report_filter_signature !== undefined &&
				this.last_report_filter_signature !== report_filter_signature
			) {
				this.current_page = 1;
			}

			this.last_report_filter_signature = report_filter_signature;
			filters._page_length = this.page_length;
			filters._page_start = (this.current_page - 1) * this.page_length;

			if (this.sort_field && this.sort_order !== "none") {
				filters._sort_field = this.sort_field;
				filters._sort_order = this.sort_order;
			}

			return filters;
		};

		report.prepare_report_data = (data) => {
			original_prepare_report_data(data);
			this.prepare_columns();
			this.total_count = data.message?.total_count || report.data.length;
			const last_page = this.get_last_page();
			if (this.current_page > last_page) {
				this.current_page = last_page;
				setTimeout(() => this.report.refresh(), 0);
			}
			this.apply_column_sort_state();
		};

		report.show_footer_message = () => {
			original_show_footer_message();
			this.render_pagination_controls();
			this.update_pagination();
		};
	},

	make_pagination_controls() {
		if (this.pagination_wrapper) return;

		this.pagination_wrapper = $(`
			<div class="supply-needs-pagination">
				<span class="supply-needs-row-count text-muted"></span>
				<div class="supply-needs-page-size">
					<span class="text-muted">${__("Rows")}</span>
					<select class="form-control input-xs" data-action="page_length">
						<option value="25">25</option>
						<option value="50" selected>50</option>
						<option value="100">100</option>
						<option value="250">250</option>
					</select>
				</div>
				<div class="supply-needs-page-buttons">
					<button class="btn btn-xs btn-default" data-action="first">${__("First")}</button>
					<button class="btn btn-xs btn-default" data-action="prev">${__("Previous")}</button>
					<span class="supply-needs-page-status text-muted"></span>
					<button class="btn btn-xs btn-default" data-action="next">${__("Next")}</button>
					<button class="btn btn-xs btn-default" data-action="last">${__("Last")}</button>
				</div>
			</div>
		`);

		this.pagination_wrapper.on("change", '[data-action="page_length"]', (event) => {
			this.page_length = cint(event.currentTarget.value) || 50;
			this.current_page = 1;
			this.render_current_page();
		});

		this.pagination_wrapper.on("click", "button[data-action]", (event) => {
			const action = event.currentTarget.dataset.action;
			const last_page = this.get_last_page();

			if (action === "first") this.current_page = 1;
			if (action === "prev") this.current_page = Math.max(1, this.current_page - 1);
			if (action === "next") this.current_page = Math.min(last_page, this.current_page + 1);
			if (action === "last") this.current_page = last_page;

			this.render_current_page();
		});
	},

	render_pagination_controls() {
		this.make_pagination_controls();
		const footer = this.report?.$report_footer;

		if (!footer?.length) return;

		footer.find(".supply-needs-pagination").remove();
		footer.prepend(this.pagination_wrapper);
	},

	update_pagination() {
		if (!this.pagination_wrapper) return;

		const total = this.total_count;
		const page_length = this.page_length;
		const last_page = this.get_last_page();
		const start = total ? (this.current_page - 1) * page_length + 1 : 0;
		const end = total ? Math.min(this.current_page * page_length, total) : 0;

		this.pagination_wrapper
			.find(".supply-needs-row-count")
			.text(__("{0} products loaded", [total]));
		this.pagination_wrapper
			.find(".supply-needs-page-status")
			.text(__("Showing {0}-{1} of {2}", [start, end, total]));
		this.pagination_wrapper
			.find('[data-action="page_length"]')
			.val(this.page_length);

		this.pagination_wrapper.find('[data-action="first"], [data-action="prev"]').prop("disabled", this.current_page <= 1);
		this.pagination_wrapper.find('[data-action="next"], [data-action="last"]').prop("disabled", this.current_page >= last_page);
	},

	prepare_columns() {
		if (!this.report?.columns) return;

		const image_column = this.report.columns.find((column) => {
			const fieldname = column.fieldname || column.id;
			return fieldname === "image";
		});
		if (!image_column) return;

		image_column.sortable = false;
		image_column.dropdown = false;
		image_column.editable = false;
		image_column.focusable = false;
	},

	render_current_page() {
		this.current_page = Math.min(this.current_page, this.get_last_page());
		this.report.refresh();
	},

	get_last_page() {
		return Math.max(1, Math.ceil(this.total_count / this.page_length));
	},

	patch_datatable_sorting(datatable) {
		if (!datatable || datatable.supply_needs_sort_patched) return;

		datatable.supply_needs_sort_patched = true;
		datatable.sortColumn = (colIndex, sortOrder) => {
			const column = datatable.datamanager.getColumn(colIndex);
			const fieldname = column?.fieldname || column?.id;

			if (!fieldname || ["_checkbox", "_rowIndex"].includes(fieldname)) return;

			this.sort_field = fieldname;
			this.sort_order = sortOrder || "none";
			this.current_page = 1;
			this.render_current_page();
		};
	},

	disable_image_column_controls(datatable) {
		const image_column = datatable?.datamanager
			?.getColumns()
			.find((column) => (column.fieldname || column.id) === "image");

		if (!image_column) return;

		const filter = datatable.header.querySelector(
			`.dt-cell--col-${image_column.colIndex} .dt-filter`
		);

		if (filter) {
			filter.disabled = true;
			filter.placeholder = "";
			filter.title = __("Image column is not searchable");
		}
	},

	apply_column_sort_state() {
		if (!this.report?.columns) return;

		this.report.columns.forEach((column) => {
			const fieldname = column.fieldname || column.id;
			column.sortOrder = fieldname === this.sort_field ? this.sort_order : "none";
		});
	},

	set_table_height(datatable) {
		const scrollable = datatable?.bodyScrollable;
		if (!scrollable) return;

		scrollable.style.height = "calc(100vh - 260px)";
		scrollable.style.maxHeight = "calc(100vh - 260px)";
		scrollable.style.minHeight = "420px";
		scrollable.style.overflowY = "auto";
	},

	parseFormattedNumber(value, numberFormat) {
		if (typeof value !== "string" || !value.trim()) {
			return NaN;
		}

		// Infer separators from number format
		let thousands_sep = numberFormat.includes(' ') ? ' ' : ',';
		let decimal_sep = numberFormat.includes(',') ? ',' : '.';

		// Replace thousands separator (remove it)
		value = value.replace(new RegExp('\\' + thousands_sep, 'g'), '');

		// Replace decimal separator with dot
		if (decimal_sep !== '.') {
			value = value.replace(decimal_sep, '.');
		}

		// Convert to float
		return parseFloat(value);
	},
	make_material_request(report) {
		let selected_rows = [];
		const numberFormat = get_number_format();

		// Get selected rows from the datatable
		if (frappe.query_report.datatable) {
			const checked_rows = frappe.query_report.datatable.rowmanager.getCheckedRows();
			selected_rows = checked_rows.map(i => {
				let rowData = frappe.query_report.data[i];
				let domRow = frappe.query_report.datatable.rowmanager.getRow$(i);
				let projectedQtyText = jQuery(domRow).find(`[data-col-index=${this.projectedQtyIndex}]`).text().trim();
				rowData.projected_qty = this.parseFormattedNumber(projectedQtyText, numberFormat);
				return rowData;
			});
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
		const numberFormat = get_number_format();

		if (frappe.query_report.datatable) {
			const checked_rows = frappe.query_report.datatable.rowmanager.getCheckedRows();
			selected_rows = checked_rows.map(i => {
				let rowData = frappe.query_report.data[i];
				let domRow = frappe.query_report.datatable.rowmanager.getRow$(i);
				let projectedQtyText = jQuery(domRow).find(`[data-col-index=${this.projectedQtyIndex}]`).text().trim();
				rowData.projected_qty = this.parseFormattedNumber(projectedQtyText, numberFormat);
				return rowData;
			});
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
