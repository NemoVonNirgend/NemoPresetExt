import { renderSwipePreview } from './preview.js';

export function showSwipePicker({ choices: swipes, active, isGreeting }, useSwipe) {
    const heading = isGreeting ? 'First messages' : 'Saved swipes';
    const choiceName = isGreeting ? 'Greeting' : 'Swipe';
    const choiceNameLower = choiceName.toLowerCase();
    const useLabel = `Use this ${choiceNameLower}`;
    const dialog = document.createElement('dialog');
    dialog.className = 'nemo-start';
    dialog.setAttribute('aria-labelledby', 'nemo-start-title');
    dialog.innerHTML = `
        <div class="nemo-start__body">
            <h2 id="nemo-start-title" tabindex="-1">${heading}</h2>
            <label class="nemo-start__search">
                <span>Search ${heading.toLowerCase()}</span>
                <input class="text_pole" type="search">
            </label>
            <div class="nemo-start__panes">
                <div class="nemo-start__choices" role="group" aria-label="${choiceName}s"></div>
                <section class="nemo-start__preview" aria-labelledby="nemo-start-preview-title">
                    <h3 id="nemo-start-preview-title"></h3>
                    <div class="nemo-start__text" tabindex="0"></div>
                </section>
            </div>
            <p class="nemo-start__status" role="status" hidden></p>
            <div class="nemo-start__actions">
                <button class="menu_button" type="button" data-action="close">Close</button>
                ${useSwipe ? `<button class="menu_button" type="button" data-action="use">${useLabel}</button>` : ''}
            </div>
        </div>`;

    const search = dialog.querySelector('input');
    const choices = dialog.querySelector('.nemo-start__choices');
    const preview = dialog.querySelector('.nemo-start__preview');
    const previewTitle = preview.querySelector('h3');
    const previewText = preview.querySelector('.nemo-start__text');
    const status = dialog.querySelector('.nemo-start__status');
    const use = dialog.querySelector('[data-action="use"]');
    const options = swipes.map((swipe, position) => ({
        ...swipe,
        label: `${choiceName} ${(isGreeting ? position : swipe.index) + 1}`,
        searchText: swipe.text.toLowerCase(),
        excerpt: swipe.text.trim().replace(/\s+/g, ' ') || 'No message text.',
    }));
    let selected = options.find(option => option.index === active);
    let previewed;
    let switching = false;

    function setStatus(text) {
        status.textContent = text;
        status.hidden = !text;
    }

    function updatePreview() {
        for (const button of choices.querySelectorAll('button')) {
            button.setAttribute('aria-pressed', String(Number(button.dataset.index) === selected?.index));
        }
        preview.hidden = !selected;
        if (selected !== previewed) {
            previewed = selected;
            previewTitle.textContent = selected?.label ?? '';
            if (selected?.text.trim()) {
                previewText.replaceChildren(renderSwipePreview(selected.text));
            } else {
                previewText.textContent = selected?.excerpt ?? '';
            }
            previewText.scrollTop = 0;
        }
        if (use) use.disabled = switching || !selected || selected.index === active;
    }

    function updateChoices() {
        const query = search.value.trim().toLowerCase();
        const matches = options.filter(option => option.searchText.includes(query) || option.label.toLowerCase().includes(query));
        if (!matches.includes(selected)) selected = matches.find(option => option.index === active) ?? matches[0];

        choices.replaceChildren(...matches.map(option => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'nemo-start__choice';
            button.dataset.index = String(option.index);
            button.innerHTML = '<span class="nemo-start__choice-title"></span><span class="nemo-start__excerpt"></span>';
            const title = button.firstElementChild;
            title.textContent = option.label;
            if (option.index === active) {
                const current = document.createElement('span');
                current.className = 'nemo-start__current';
                current.textContent = 'Current';
                title.append(current);
            }
            button.lastElementChild.textContent = option.excerpt;
            button.setAttribute('aria-label', option.index === active ? `${option.label}, current` : option.label);
            button.addEventListener('click', () => {
                selected = option;
                setStatus('');
                updatePreview();
            });
            return button;
        }));
        choices.scrollTop = 0;
        setStatus(matches.length ? '' : `No matching ${choiceNameLower}s.`);
        updatePreview();
    }

    search.addEventListener('input', updateChoices);
    dialog.addEventListener('keydown', event => event.stopPropagation());
    dialog.querySelector('[data-action="close"]').addEventListener('click', () => dialog.close());
    use?.addEventListener('click', async () => {
        if (use.disabled) return;
        switching = true;
        use.disabled = true;
        use.textContent = 'Switching…';
        setStatus('');
        const error = await useSwipe(selected);
        if (!dialog.open) return;
        if (!error) {
            dialog.close();
            return;
        }
        switching = false;
        use.textContent = useLabel;
        use.disabled = !selected || selected.index === active;
        setStatus(error);
    });

    updateChoices();
    const focusTarget = matchMedia('(pointer: coarse)').matches ? dialog.querySelector('h2') : search;
    focusTarget.autofocus = true;
    document.body.append(dialog);
    dialog.showModal();
    choices.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest' });
    return dialog;
}
