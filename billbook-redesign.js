/* InvoTracker - myBillBook-inspired interface */
(() => {
  "use strict";

  const el = id => document.getElementById(id);
  const $ = (selector, root = document) => root.querySelector(selector);

  const money = value =>
      "₹" + (Number(value) || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

  const escapeHtml = value =>
      String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[character]));

  function navigate(page) {
    document.querySelector(
        `.sidebarLink[data-page="${page}"]`
    )?.click();
  }

  // Navigation
  el("bbQuickCreate")?.addEventListener("click", () => {
    navigate("create");
  });

  el("bbInvoiceBack")?.addEventListener("click", () => {
    navigate("invoices");
  });

  el("bbAddProductJump")?.addEventListener("click", () => {
    el("productForm")?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
    el("productName")?.focus();
  });

  // Global search
  let searchTimer;

  el("bbGlobalSearch")?.addEventListener("input", event => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
      const query = event.target.value.trim();
      if (!query) return;

      navigate("invoices");

      const input = el("search");
      if (input) {
        input.value = query;
        input.dispatchEvent(new Event("input", {
          bubbles: true
        }));
      }
    }, 280);
  });

  // Inventory search
  el("bbItemSearch")?.addEventListener("input", event => {
    const query = event.target.value.toLowerCase().trim();

    el("productRows")?.querySelectorAll("tr").forEach(row => {
      row.hidden = !row.textContent.toLowerCase().includes(query);
    });
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", event => {
    if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
    ) {
      event.preventDefault();
      el("bbGlobalSearch")?.focus();
    }

    if (event.key === "Escape" && el("bbInvoiceDialog")?.open) {
      el("bbInvoiceDialog").close();
    }
  });

  // Dashboard overview heading is rendered in index.html directly below the business name.
  // Do not inject a second overview panel below the dashboard.

  // =============================================
  // MYBILLBOOK-STYLE CREATE SALES INVOICE
  // =============================================

  const page = el("createInvoicePage");
  const form = el("invoiceForm");

  if (!page || !form) return;

  page.classList.add("bb4-page");
  form.classList.add("bb4-form");

  // Header
  const heading = $("h2", page);
  if (heading) heading.textContent = "Create Sales Invoice";

  const intro = page.querySelector(":scope > p");
  if (intro) intro.hidden = true;

  const toolbar = $(".bb-invoice-toolbar", page);
  const saveButton = $('button[type="submit"]', form);

  if (saveButton) {
    saveButton.textContent = "Save";
    saveButton.classList.add("bb4-save");
  }

  if (toolbar && saveButton) {
    const saveNew = document.createElement("button");

    saveNew.type = "button";
    saveNew.className = "bb4-save-new";
    saveNew.textContent = "Save & New";

    saveNew.addEventListener("click", () => {
      if (form.requestSubmit) {
        form.requestSubmit(saveButton);
      } else {
        saveButton.click();
      }
    });

    toolbar.append(saveNew);

    // Keep submit button associated with original form
    saveButton.setAttribute("form", "invoiceForm");
    toolbar.append(saveButton);
  }

  // =============================================
  // BILL TO | SHIP TO | INVOICE DETAILS
  // =============================================

  const billing = $(".bb-billing", form);
  const meta = $(".bb-meta", form);
  const items = $(".invoice-items-editor", form);
  const payment = $(".bb-payment-section", form);
  const summary = $(".bb-invoice-summary", form);
  const notes = $(".bb-invoice-notes", form);
  const preflight = el("invoicePreflight");

  const top = document.createElement("div");
  top.className = "bb4-top";

  const ship = document.createElement("section");
  ship.className = "bb4-ship";

  const shipSection = document.querySelector(".bb4-ship");

  if (shipSection && !document.getElementById("shippingAddress")) {
    shipSection.insertAdjacentHTML("beforeend", `
        <textarea
            id="shippingAddress"
            name="shippingAddress"
            placeholder="Enter shipping address"
            rows="3"
            maxlength="1000"
        ></textarea>
    `);
  }
  ship.innerHTML = `
    <h3>Ship To</h3>

    <div class="bb4-ship-content">
      <strong id="bb4ShipName">
        Customer not selected
      </strong>

      <span>Same as billing customer</span>
    </div>
  `;

  if (billing) {
    billing.before(top);
    top.append(billing, ship);

    const billingHeading = $("h3", billing);
    if (billingHeading) billingHeading.textContent = "Bill To";
  }

  if (meta) {
    top.append(meta);

    const metaHeading = $("h3", meta);
    if (metaHeading) metaHeading.textContent = "Invoice Details";
  }

  // Shipping display follows billing customer
  const customerName = form.elements.namedItem("customerName");

  function updateShippingCustomer() {
    const target = el("bb4ShipName");

    if (target) {
      target.textContent =
          customerName?.value.trim() || "Customer not selected";
    }
  }

  customerName?.addEventListener("input", updateShippingCustomer);

  el("savedCustomer")?.addEventListener("change", () => {
    setTimeout(updateShippingCustomer, 0);
  });

  updateShippingCustomer();

  // =============================================
  // PRODUCTS / SERVICES TABLE
  // =============================================

  if (items) {
    const itemsHeading = $("h3", items);
    if (itemsHeading) itemsHeading.textContent = "Items";

    const rows = el("invoiceItemRows");

    if (rows) {
      const tableHeader = document.createElement("div");
      tableHeader.className = "bb4-item-head";

      tableHeader.innerHTML = `
        <span>NO</span>
        <span>ITEM / SERVICE</span>
        <span>CATALOG PRODUCT</span>
        <span>QTY</span>
        <span>PRICE / ITEM (₹)</span>
        <span>DISCOUNT %</span>
        <span>TAX %</span>
        <span>REMOVE</span>
      `;

      rows.before(tableHeader);

      function numberRows() {
        rows.querySelectorAll(".invoice-item-row").forEach((row, index) => {
          row.dataset.line = String(index + 1);
        });
      }

      new MutationObserver(numberRows).observe(rows, {
        childList: true
      });

      numberRows();
    }

    // Barcode scanner: collapsed by default
    const pos = $(".pos-entry", items);

    if (pos) {
      const advanced = document.createElement("details");
      advanced.className = "bb4-scan";

      const label = document.createElement("summary");
      label.textContent = "▥ Scan Barcode / Advanced Tools";

      advanced.append(label);
      pos.before(advanced);
      advanced.append(pos);

      const voice = el("voiceInvoice");
      const voiceStatus = el("voiceStatus");

      if (voice) advanced.append(voice);
      if (voiceStatus) advanced.append(voiceStatus);
    }

    // Item search
    const search = el("quickProductSearch");

    if (search) {
      search.placeholder = "Search existing items by name or SKU...";
    }

    // Add Item / Scan Barcode controls
    const addButton = el("addInvoiceItem");

    if (addButton) {
      const actions = document.createElement("div");
      actions.className = "bb4-item-actions";

      addButton.before(actions);
      actions.append(addButton);

      const advanced = $(".bb4-scan", items);
      if (advanced) actions.append(advanced);
    }

    // Retain old totals for original app.js calculations
    const originalTotals = el("invoiceItemTotals");

    if (originalTotals) {
      originalTotals.classList.add("bb4-hidden-total");
    }
  }

  // =============================================
  // NOTES | TOTALS | PAYMENT
  // =============================================

  if (notes) {
    const heading = $("h3", notes);
    if (heading) heading.textContent = "Notes & Terms";
  }

  if (payment) {
    const heading = $("h3", payment);
    if (heading) heading.textContent = "Payment Received";
  }

  const bottom = document.createElement("div");
  bottom.className = "bb4-bottom";

  if (notes) {
    notes.before(bottom);
    bottom.append(notes);
  } else if (summary) {
    summary.before(bottom);
  } else if (payment) {
    payment.before(bottom);
  }

  if (summary) bottom.append(summary);
  if (payment) bottom.append(payment);
  if (preflight) bottom.append(preflight);

  // Move invoice discount into summary
  const discount = form.elements.namedItem("discount");

  if (discount?.closest("label") && summary) {
    const discountLabel = discount.closest("label");

    discountLabel.classList.add("bb4-discount");
    summary.append(discountLabel);
  }

  // =============================================
  // OPTIONAL SMART INVOICE COPILOT
  // =============================================

  const copilot = el("copilotPanel");

  // Keep the Copilot visible at the top of the invoice editor.

  // =============================================
  // PRODUCT SEARCH USING EXISTING CATALOG
  // =============================================

  const productSearch = el("quickProductSearch");
  const productResults = el("quickProductResults");

  if (productSearch && productResults) {
    productSearch.addEventListener("input", () => {
      const query = productSearch.value.trim().toLowerCase();

      productResults.replaceChildren();

      if (!query) {
        productResults.style.display = "none";
        return;
      }

      const catalog = $(
          "#invoiceItemRows .invoice-item-row .item-product",
          form
      );

      if (!catalog) {
        productResults.style.display = "none";
        return;
      }

      const matches = [...catalog.options]
          .filter(option =>
              option.value &&
              option.textContent.toLowerCase().includes(query)
          )
          .slice(0, 12);

      matches.forEach(option => {
        const button = document.createElement("button");

        button.type = "button";
        button.textContent = option.textContent;

        button.addEventListener("click", () => {
          const container = el("invoiceItemRows");

          let row = [...container.querySelectorAll(".invoice-item-row")]
              .find(item =>
                  !$(".item-description", item)?.value.trim()
              );

          if (!row) {
            el("addInvoiceItem")?.click();
            row = container.querySelector(".invoice-item-row:last-child");
          }

          const picker = row?.querySelector(".item-product");
          if (!picker) return;

          picker.value = option.value;

          picker.dispatchEvent(new Event("change", {
            bubbles: true
          }));

          productSearch.value = "";
          productResults.replaceChildren();
          productResults.style.display = "none";
        });

        productResults.append(button);
      });

      productResults.style.display =
          matches.length ? "block" : "none";
    });
  }

  // =============================================
  // LIVE INVOICE SUMMARY
  // =============================================

  function refreshSummary() {
    let subtotal = 0;
    let gst = 0;

    el("invoiceItemRows")
        ?.querySelectorAll(".invoice-item-row")
        .forEach(row => {
          const quantity = Number($(".item-quantity", row)?.value || 0);
          const price = Number($(".item-price", row)?.value || 0);
          const itemDiscount = Number($(".item-discount", row)?.value || 0);

          const taxRate = Number(
              $(".item-gst", row)?.value ||
              form.elements.namedItem("gstRate")?.value ||
              0
          );

          const line = quantity * price * (1 - itemDiscount / 100);

          subtotal += line;
          gst += line * taxRate / 100;
        });

    const invoiceDiscount = Number(
        form.elements.namedItem("discount")?.value || 0
    );

    const taxable = Math.max(0, subtotal - invoiceDiscount);

    gst = subtotal > 0
        ? gst * taxable / subtotal
        : 0;

    const total = taxable + gst;

    const paymentStatus = el("bbPaymentStatus");
    const received = el("bbAmountReceived");

    if (paymentStatus && received) {
      if (paymentStatus.value === "PAID") {
        received.value = total.toFixed(2);
        received.readOnly = true;
      } else if (paymentStatus.value === "UNPAID") {
        received.value = "0";
        received.readOnly = true;
      } else {
        received.readOnly = false;
      }
    }

    const amountReceived = Number(received?.value || 0);

    const values = {
      bbSummarySubtotal: subtotal,
      bbSummaryDiscount: invoiceDiscount,
      bbSummaryGST: gst,
      bbSummaryTotal: total,
      bbSummaryReceived: amountReceived,
      bbSummaryBalance: Math.max(0, total - amountReceived)
    };

    Object.entries(values).forEach(([id, value]) => {
      const target = el(id);
      if (target) target.textContent = money(value);
    });
  }

  form.addEventListener("input", refreshSummary);
  form.addEventListener("change", refreshSummary);

  const invoiceRows = el("invoiceItemRows");

  if (invoiceRows) {
    new MutationObserver(refreshSummary).observe(invoiceRows, {
      childList: true
    });
  }

  refreshSummary();

  // =============================================
  // INVOICE PREVIEW
  // =============================================

  function getDraft() {
    const rows = [...(
        el("invoiceItemRows")
            ?.querySelectorAll(".invoice-item-row") || []
    )].map(row => ({
      description: $(".item-description", row)?.value || "",
      quantity: Number($(".item-quantity", row)?.value || 0),
      price: Number($(".item-price", row)?.value || 0),
      discount: Number($(".item-discount", row)?.value || 0),
      gst: Number(
          $(".item-gst", row)?.value ||
          form.elements.namedItem("gstRate")?.value ||
          0
      )
    })).filter(item => item.description.trim());

    const subtotal = rows.reduce(
        (sum, item) =>
            sum + item.quantity * item.price * (1 - item.discount / 100),
        0
    );

    const invoiceDiscount = Number(
        form.elements.namedItem("discount")?.value || 0
    );

    const taxable = Math.max(0, subtotal - invoiceDiscount);

    const gstBeforeDiscount = rows.reduce((sum, item) => {
      const line = item.quantity * item.price *
          (1 - item.discount / 100);

      return sum + line * item.gst / 100;
    }, 0);

    const gst = subtotal > 0
        ? gstBeforeDiscount * taxable / subtotal
        : 0;

    return {
      rows,
      subtotal,
      invoiceDiscount,
      gst,
      total: taxable + gst
    };
  }

  function previewInvoice() {
    const draft = getDraft();

    if (!draft.rows.length) {
      alert("Add at least one item before previewing.");
      return;
    }

    const body = el("bbPreviewBody");
    if (!body) return;

    const field = name =>
        form.elements.namedItem(name)?.value || "";

    const tableRows = draft.rows.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.description)}</td>
        <td>${item.quantity}</td>
        <td>${money(item.price)}</td>
        <td>${item.gst}%</td>
        <td>
          ${money(
        item.quantity * item.price *
        (1 - item.discount / 100)
    )}
        </td>
      </tr>
    `).join("");

    body.innerHTML = `
      <article class="bb-print-sheet">
        <div class="bb-print-head">
          <div>
            <h2>InvoTracker</h2>
            <p>Invoice Management</p>
          </div>
          <strong>TAX INVOICE · DRAFT</strong>
        </div>

        <div class="bb-print-meta">
          <div>
            <b>Bill To</b>
            <p>${escapeHtml(field("customerName"))}</p>
            <p>${escapeHtml(field("customerEmail"))}</p>
            <p>${escapeHtml(field("customerGstin"))}</p>
          </div>

          <div>
            <p><b>Invoice:</b> ${escapeHtml(field("invoiceNumber"))}</p>
            <p><b>Date:</b> ${escapeHtml(field("issueDate"))}</p>
            <p><b>Due:</b> ${escapeHtml(field("dueDate"))}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>GST</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>

        <div class="bb-print-total">
          <p>Subtotal: ${money(draft.subtotal)}</p>
          <p>Discount: ${money(draft.invoiceDiscount)}</p>
          <p>GST: ${money(draft.gst)}</p>
          <p>Total: ${money(draft.total)}</p>
        </div>

        <div class="bb-print-note">
          Draft preview only. Final values are calculated
          by the server when the invoice is saved.
        </div>
      </article>
    `;

    el("bbInvoiceDialog")?.showModal();
  }

  el("bbPreviewInvoice")?.addEventListener("click", previewInvoice);

  el("bbCloseInvoice")?.addEventListener("click", () => {
    el("bbInvoiceDialog")?.close();
  });

  el("bbPrintInvoice")?.addEventListener("click", () => {
    window.print();
  });

  console.info(
      "InvoTracker myBillBook-style invoice workspace v4 loaded"
  );
})();