import { registerBlockType } from '@wordpress/blocks';
import { useBlockProps } from '@wordpress/block-editor';
import { createElement } from '@wordpress/element';

registerBlockType( 'askchokro/chat', {
	edit: function () {
		const blockProps = useBlockProps();
		return createElement(
			'div',
			blockProps,
			createElement(
				'div',
				{ style: { border: '1px dashed #ccc', padding: '20px', textAlign: 'center', background: '#f9f9f9' } },
				createElement( 'strong', null, 'AskChokro Chat Block' ),
				createElement( 'p', null, 'This block will render the AskChokro chat widget on the frontend.' )
			)
		);
	},
	// We use a dynamic block (render.php) for the frontend output so save returns null.
	save: function () {
		return null;
	},
} );
