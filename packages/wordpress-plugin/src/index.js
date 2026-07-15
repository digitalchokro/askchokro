import { registerBlockType } from '@wordpress/blocks';
import { useBlockProps } from '@wordpress/block-editor';

registerBlockType( 'askchokro/chat', {
	edit: function () {
		const blockProps = useBlockProps();
		return (
			<div { ...blockProps }>
				<div style={{ border: '1px dashed #ccc', padding: '20px', textAlign: 'center', background: '#f9f9f9' }}>
					<strong>AskChokro Chat Block</strong>
					<p>This block will render the AskChokro chat widget on the frontend.</p>
				</div>
			</div>
		);
	},
	// We use a dynamic block (render.php) for the frontend output so save returns null.
	save: function () {
		return null;
	},
} );
