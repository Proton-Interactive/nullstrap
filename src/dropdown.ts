export function setupCustomDropdowns() {
    const selects = document.querySelectorAll("select");
    selects.forEach((select) => {
        // Prevent double initialization
        if (select.getAttribute("data-custom-initialized") === "true") return;

        setupCustomDropdown(select as HTMLSelectElement);
        select.setAttribute("data-custom-initialized", "true");
    });
}

function setupCustomDropdown(select: HTMLSelectElement) {
    const wrapper = document.createElement("div");
    wrapper.className = "custom-select-wrapper";

    const trigger = document.createElement("div");
    trigger.className = "custom-select-trigger";

    const selectedText = document.createElement("span");
    selectedText.textContent = select.options[select.selectedIndex]?.text || "Select...";
    trigger.appendChild(selectedText);

    // Add an arrow indicator
    const arrow = document.createElement("div");
    arrow.className = "custom-select-arrow";
    trigger.appendChild(arrow);

    const optionsList = document.createElement("div");
    optionsList.className = "custom-options";

    // Build options
    Array.from(select.options).forEach((option) => {
        const optionItem = document.createElement("div");
        optionItem.className = "custom-option";
        optionItem.textContent = option.text;
        optionItem.dataset.value = option.value;

        if (option.selected) {
            optionItem.classList.add("selected");
        }

        optionItem.addEventListener("click", (e) => {
            e.stopPropagation(); // Prevent bubbling to wrapper click

            // Update visual selection
            optionsList.querySelectorAll(".custom-option").forEach((opt) => opt.classList.remove("selected"));
            optionItem.classList.add("selected");
            selectedText.textContent = option.text;

            // Close dropdown
            wrapper.classList.remove("open");

            // Update native select
            if (select.value !== option.value) {
                select.value = option.value;
                select.dispatchEvent(new Event("change", { bubbles: true }));
            }
        });

        optionsList.appendChild(optionItem);
    });

    wrapper.appendChild(trigger);
    wrapper.appendChild(optionsList);

    // Insert wrapper after select
    if (select.parentNode) {
        select.parentNode.insertBefore(wrapper, select.nextSibling);
    }
    select.style.display = "none";

    // Toggle open/close
    trigger.addEventListener("click", (e) => {
        e.stopPropagation();

        // Close all other dropdowns first
        document.querySelectorAll(".custom-select-wrapper").forEach((other) => {
            if (other !== wrapper) {
                other.classList.remove("open");
            }
        });

        wrapper.classList.toggle("open");
    });

    // Close on click outside
    document.addEventListener("click", (e) => {
        if (!wrapper.contains(e.target as Node)) {
            wrapper.classList.remove("open");
        }
    });

    // Listen for changes on the original select (in case it's changed programmatically or via event dispatch)
    select.addEventListener("change", () => {
        const currentOption = select.options[select.selectedIndex];
        if (currentOption) {
            selectedText.textContent = currentOption.text;
            optionsList.querySelectorAll(".custom-option").forEach((opt) => {
                if ((opt as HTMLElement).dataset.value === currentOption.value) {
                    opt.classList.add("selected");
                } else {
                    opt.classList.remove("selected");
                }
            });
        }
    });
}
