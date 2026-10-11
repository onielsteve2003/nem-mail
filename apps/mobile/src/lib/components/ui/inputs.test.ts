import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import Checkbox from './Checkbox.svelte';
import Radio from './Radio.svelte';
import SearchField from './SearchField.svelte';
import SegmentedControl from './SegmentedControl.svelte';
import TextField from './TextField.svelte';
import Toggle from './Toggle.svelte';

describe('TextField', () => {
	it('labels the input and links the hint', () => {
		render(TextField, { label: 'Subject', hint: 'Keep it short', value: 'Hi' });
		const input = screen.getByLabelText('Subject');

		expect(input).toHaveValue('Hi');
		expect(input).toHaveAccessibleDescription('Keep it short');
		expect(input).not.toHaveAttribute('aria-invalid');
	});

	it('marks an error and announces it instead of the hint', () => {
		render(TextField, { label: 'To', hint: 'Add people', error: 'Enter a valid email' });
		const input = screen.getByLabelText('To');

		expect(input).toHaveAttribute('aria-invalid', 'true');
		expect(input).toHaveAccessibleDescription('Enter a valid email');
		expect(screen.queryByText('Add people')).toBeNull();
	});

	it('forwards native attributes', () => {
		render(TextField, { label: 'Email', type: 'email', required: true, disabled: true });
		const input = screen.getByLabelText('Email');

		expect(input).toHaveAttribute('type', 'email');
		expect(input).toBeRequired();
		expect(input).toBeDisabled();
	});
});

describe('SearchField', () => {
	it('is a named search box with no clear button while empty', () => {
		render(SearchField, { label: 'Search mail' });

		expect(screen.getByRole('searchbox', { name: 'Search mail' })).toHaveAttribute(
			'placeholder',
			'Search mail'
		);
		expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
	});

	it('clears the query, refocuses and reports it', async () => {
		const onclear = vi.fn();
		render(SearchField, { label: 'Search mail', value: 'from:ada', onclear });
		const input = screen.getByRole('searchbox');

		await fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

		expect(input).toHaveValue('');
		expect(input).toHaveFocus();
		expect(onclear).toHaveBeenCalledOnce();
		expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
	});
});

describe('Toggle', () => {
	it('is a switch that flips when tapped', async () => {
		render(Toggle, { label: 'Smart compose', description: 'Suggests text as you type' });
		const toggle = screen.getByRole('switch', { name: 'Smart compose' });

		expect(toggle).not.toBeChecked();
		expect(toggle).toHaveAccessibleDescription('Suggests text as you type');

		await fireEvent.click(toggle);
		expect(toggle).toBeChecked();
	});

	it('respects disabled', () => {
		render(Toggle, { label: 'Smart compose', checked: true, disabled: true });

		expect(screen.getByRole('switch')).toBeDisabled();
	});
});

describe('Checkbox', () => {
	it('toggles when its label is tapped', async () => {
		render(Checkbox, { label: 'Select all' });
		const box = screen.getByRole('checkbox', { name: 'Select all' });

		await fireEvent.click(screen.getByText('Select all'));

		expect(box).toBeChecked();
	});

	it('shows the mixed state', () => {
		render(Checkbox, { label: 'Select all', indeterminate: true });

		expect(screen.getByRole('checkbox')).toBePartiallyChecked();
	});
});

describe('Radio', () => {
	it('is checked when the group holds its value', () => {
		render(Radio, { label: 'Reply', name: 'default-reply', value: 'reply', group: 'reply' });
		render(Radio, { label: 'Reply all', name: 'default-reply', value: 'all', group: 'reply' });

		expect(screen.getByRole('radio', { name: 'Reply' })).toBeChecked();
		expect(screen.getByRole('radio', { name: 'Reply all' })).not.toBeChecked();
	});

	it('selects on tap', async () => {
		render(Radio, { label: 'Reply all', name: 'r', value: 'all', group: 'reply' });
		const radio = screen.getByRole('radio', { name: 'Reply all' });

		await fireEvent.click(radio);

		expect(radio).toBeChecked();
	});
});

describe('SegmentedControl', () => {
	const options = [
		{ value: 'default', label: 'Default' },
		{ value: 'comfortable', label: 'Comfortable' },
		{ value: 'compact', label: 'Compact' }
	];

	it('is a named radio group with the value checked', () => {
		render(SegmentedControl, { label: 'Density', options, value: 'comfortable' });

		expect(screen.getByRole('radiogroup', { name: 'Density' })).toBeInTheDocument();
		expect(screen.getByRole('radio', { name: 'Comfortable' })).toBeChecked();
		expect(screen.getAllByRole('radio')).toHaveLength(3);
	});

	it('reports the new value and moves the active state', async () => {
		const onchange = vi.fn();
		const { container } = render(SegmentedControl, {
			label: 'Density',
			options,
			value: 'default',
			onchange
		});

		await fireEvent.click(screen.getByRole('radio', { name: 'Compact' }));

		expect(onchange).toHaveBeenCalledWith('compact');
		expect(screen.getByRole('radio', { name: 'Compact' })).toBeChecked();
		expect(container.querySelector('.segmented__option--active')).toHaveTextContent('Compact');
	});

	it('disables every segment', () => {
		render(SegmentedControl, { label: 'Density', options, value: 'default', disabled: true });

		for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
	});
});
